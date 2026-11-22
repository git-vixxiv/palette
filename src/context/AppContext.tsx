import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  orderBy,
  getDoc,
  setDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  auth,
  db,
  googleProvider,
  functions,
  isFirebaseConfigured,
  handleFirestoreError,
  OperationType
} from "../firebase";
import { Palette, ColorItem, HarmonyMode, UserSubscription } from "../types";
import { generateHarmony, getRandomHex, ColorRole, hexToRgb, rgbToHsl, offsetColor } from "../utils/colorUtils";

interface AppContextType {
  user: User | null;
  loadingAuth: boolean;
  isDbActive: boolean;
  savedPalettes: Palette[];
  loadingPalettes: boolean;
  currentColors: ColorItem[];
  harmonyMode: HarmonyMode;
  notification: { message: string; type: "success" | "info" | "error" } | null;
  
  // Subscription / Monetization State
  userSubscription: UserSubscription;
  loadingSub: boolean;
  showUpgradeModal: boolean;
  setShowUpgradeModal: (show: boolean) => void;
  // Real Square checkout: takes a tokenized card from the Web Payments SDK,
  // charges via the backend Cloud Function, then refreshes the local tier.
  purchasePro: (
    plan: 'monthly' | 'annual' | 'lifetime',
    token: string,
    verificationToken?: string
  ) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  refreshSubscription: () => Promise<void>;

  // Color controls
  setColors: React.Dispatch<React.SetStateAction<ColorItem[]>>;
  setHarmonyMode: (mode: HarmonyMode) => void;
  updateColorIndex: (index: number, hex: string) => void;
  updateColorRole: (index: number, role: ColorRole) => void;
  toggleColorLock: (index: number) => void;
  regenerateUnlocked: () => void;
  spinPalette: () => void;
  isSpinning: boolean;
  previousColors: ColorItem[];
  
  // Historical states
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  
  // Columns & Palette Expansion
  addColumn: () => void;
  removeColumn: (index: number) => void;
  
  // Auth & Storage DB controls
  loginWithGoogle: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  saveCurrentPalette: (name: string) => Promise<void>;
  deleteSavedPalette: (paletteId: string) => Promise<void>;
  loadSavedPalette: (palette: Palette) => void;
  showToast: (message: string, type?: "success" | "info" | "error") => void;
  clearToast: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [savedPalettes, setSavedPalettes] = useState<Palette[]>([]);
  const [loadingPalettes, setLoadingPalettes] = useState(false);
  const [notification, setNotification] = useState<AppContextType["notification"]>(null);

  // Subscription Details States
  const [userSubscription, setUserSubscription] = useState<UserSubscription>({
    tier: "free",
    updatedAt: new Date().toISOString()
  });
  const [loadingSub, setLoadingSub] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Default color palette setup initialized with brand colors: #1a1a1a, #d1c69e, #2589BD, #f4f4f4
  const [currentColors, setColorsState] = useState<ColorItem[]>([
    { hex: "#2589BD", role: "primary", locked: false },
    { hex: "#d1c69e", role: "secondary", locked: false },
    { hex: "#f4f4f4", role: "neutral-light", locked: false },
    { hex: "#1a1a1a", role: "neutral-dark", locked: false },
  ]);
  const [harmonyMode, setHarmonyState] = useState<HarmonyMode>("analogous");

  // History system tracks complete, valid color compositions
  const [history, setHistory] = useState<ColorItem[][]>([[
    { hex: "#2589BD", role: "primary", locked: false },
    { hex: "#d1c69e", role: "secondary", locked: false },
    { hex: "#f4f4f4", role: "neutral-light", locked: false },
    { hex: "#1a1a1a", role: "neutral-dark", locked: false },
  ]]);
  const [historyPointer, setHistoryPointer] = useState<number>(0);
  const isTraversing = React.useRef(false);

  const showToast = (message: string, type: "success" | "info" | "error" = "success") => {
    setNotification({ message, type });
  };

  const clearToast = () => setNotification(null);

  // Monitor Authentication state
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  // A monthly/annual plan only counts as Pro while it is paid through. The
  // backend moves premiumExpires forward on every successful renewal, so once
  // it is more than 3 days in the past (grace for payment retries / webhook
  // delay) the account is treated as free. Mirrors hasProAccess() in
  // firestore.rules. Lifetime never lapses.
  const PRO_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
  const resolveEffectiveTier = (
    tier: UserSubscription["tier"] | undefined,
    premiumExpires?: string
  ): UserSubscription["tier"] => {
    if (tier === "pro-monthly" || tier === "pro-annual") {
      const expires = premiumExpires ? Date.parse(premiumExpires) : NaN;
      if (!Number.isFinite(expires) || expires + PRO_GRACE_MS < Date.now()) return "free";
      return tier;
    }
    return tier || "free";
  };

  // Fetch subscription tier status
  const fetchSubscription = async (uid: string) => {
    // NOTE: comp / admin access will be granted server-side via the upcoming
    // admin tooling (backend writes the tier through the Admin SDK). There is
    // intentionally no client-side tier override here.
    setLoadingSub(true);
    if (isFirebaseConfigured && db) {
      try {
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserSubscription({
            tier: resolveEffectiveTier(data.tier, data.premiumExpires),
            subscriptionId: data.subscriptionId,
            subscriptionStatus: data.subscriptionStatus,
            premiumExpires: data.premiumExpires,
            pricingPlan: data.pricingPlan,
            updatedAt: data.updatedAt?.toDate?.() || new Date()
          });
        } else {
          const defaultSub: UserSubscription = {
            tier: "free",
            updatedAt: new Date()
          };
          await setDoc(userRef, {
            userId: uid,
            email: auth.currentUser?.email || "",
            tier: "free",
            updatedAt: serverTimestamp()
          });
          setUserSubscription(defaultSub);
        }
      } catch (err) {
        console.error("Fetch subscription error:", err);
      } finally {
        setLoadingSub(false);
      }
    } else {
      // Offline fallback: load from LocalStorage
      try {
        const stored = localStorage.getItem(`palette_generator_sub_${uid}`);
        if (stored) {
          setUserSubscription(JSON.parse(stored));
        } else {
          const defaultSub: UserSubscription = {
            tier: "free",
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem(`palette_generator_sub_${uid}`, JSON.stringify(defaultSub));
          setUserSubscription(defaultSub);
        }
      } catch (e) {
        console.error("Local load premium fail:", e);
      } finally {
        setLoadingSub(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubscription(user.uid);
    } else {
      fetchSubscription("local_guest");
    }
  }, [user]);

  // Re-read the authoritative subscription tier from the backend/Firestore.
  const refreshSubscription = async () => {
    const uid = user ? user.uid : "local_guest";
    await fetchSubscription(uid);
  };

  // Real Square checkout. The card is tokenized in the browser by Square's
  // Web Payments SDK (see UpgradeModal); here we hand that single-use token to
  // the backend, which performs the actual charge / subscription creation and
  // grants the tier server-side. We then refresh from Firestore.
  const purchasePro = async (
    plan: 'monthly' | 'annual' | 'lifetime',
    token: string,
    verificationToken?: string
  ) => {
    if (!user) {
      showToast("Please sign in before subscribing.", "error");
      throw new Error("You must be signed in to subscribe.");
    }
    if (!isFirebaseConfigured || !functions) {
      showToast("Billing is unavailable right now. Please try again later.", "error");
      throw new Error("Billing backend is not configured.");
    }

    const callable = httpsCallable(functions, "createSubscription");
    const res: any = await callable({ plan, token, verificationToken });

    if (res?.data?.success) {
      await fetchSubscription(user.uid);
      showToast(`Unlocked PRO! ${res.data.pricingPlan || "Welcome aboard"}.`, "success");
      setShowUpgradeModal(false);
    } else {
      throw new Error("Checkout did not complete.");
    }
  };

  // Cancel a recurring subscription via the backend (schedules cancellation at
  // period end through Square; the webhook finalizes the downgrade).
  const cancelSubscription = async () => {
    if (!user) {
      showToast("Please sign in.", "error");
      return;
    }
    if (userSubscription.tier === "pro-lifetime") {
      showToast("Lifetime access can't be cancelled.", "info");
      return;
    }
    if (!isFirebaseConfigured || !functions) {
      showToast("Billing is unavailable right now.", "error");
      return;
    }
    try {
      const callable = httpsCallable(functions, "cancelSubscription");
      await callable({});
      await fetchSubscription(user.uid);
      showToast("Your subscription will end at the close of the billing period.", "info");
    } catch (err: any) {
      showToast(err?.message || "Could not cancel subscription.", "error");
    }
  };

  // History sync manager: Record any valid structural change made by user, dropping invalid hex or traversal states
  useEffect(() => {
    if (isTraversing.current) {
      isTraversing.current = false;
      return;
    }

    const allValid = currentColors.every((c) => /^#[0-9A-F]{6}$/i.test(c.hex) || /^#[0-9A-F]{3}$/i.test(c.hex));
    if (!allValid) return;

    setHistory((prev) => {
      const sliced = prev.slice(0, historyPointer + 1);
      const last = sliced[sliced.length - 1];
      if (last) {
        const isIdentical = last.length === currentColors.length && last.every((c, i) => c.hex === currentColors[i].hex && c.role === currentColors[i].role && c.locked === currentColors[i].locked);
        if (isIdentical) return prev;
      }
      
      const updated = [...sliced, currentColors];
      setHistoryPointer(updated.length - 1);
      return updated;
    });
  }, [currentColors]);

  // Wrapper setColors preserves local state with automatic deep-cloning
  const setColors: React.Dispatch<React.SetStateAction<ColorItem[]>> = (value) => {
    setColorsState(value);
  };

  const undo = () => {
    if (historyPointer > 0) {
      isTraversing.current = true;
      const nextPointer = historyPointer - 1;
      setHistoryPointer(nextPointer);
      setColorsState(history[nextPointer]);
      showToast("Undone last design step", "info");
    }
  };

  const redo = () => {
    if (historyPointer < history.length - 1) {
      isTraversing.current = true;
      const nextPointer = historyPointer + 1;
      setHistoryPointer(nextPointer);
      setColorsState(history[nextPointer]);
      showToast("Redone design step", "info");
    }
  };

  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < history.length - 1;

  // Add column adds color elements dynamically to the palette layout up to 10
  const addColumn = () => {
    if (userSubscription.tier === "free" && currentColors.length >= 5) {
      showToast("Free tier is limited to 5 color columns. Upgrade to PRO to unlock up to 10!", "error");
      setShowUpgradeModal(true);
      return;
    }

    setColors((prev) => {
      if (prev.length >= 10) {
        showToast("Maximum of 10 color columns allowed", "error");
        return prev;
      }
      
      // Select appropriate role recommendation
      const roles: ColorRole[] = ["primary", "secondary", "accent", "neutral-light", "neutral-dark"];
      const missingRoles = roles.filter(r => !prev.some(col => col.role === r));
      const chosenRole = missingRoles.length > 0 ? missingRoles[0] : "secondary";
      
      // Compute matching next harmony hex
      const anchorIdx = prev.findIndex((c) => c.locked);
      const anchorHex = anchorIdx !== -1 ? prev[anchorIdx].hex : prev[0].hex;
      const newHexes = generateHarmony(harmonyMode, anchorHex, prev.length + 1);
      const newHex = newHexes[newHexes.length - 1] || getRandomHex();
      
      const updated = [
        ...prev,
        { hex: newHex, role: chosenRole, locked: false }
      ];
      showToast("Expanded palette block!", "success");
      return updated;
    });
  };

  // Remove column strips element from index down to minimum of 3
  const removeColumn = (index: number) => {
    setColors((prev) => {
      if (prev.length <= 3) {
        showToast("At least 3 colors required on custom palette", "error");
        return prev;
      }
      const updated = prev.filter((_, idx) => idx !== index);
      showToast("Compressed palette column", "info");
      return updated;
    });
  };

  // Set harmony mode and update unlocked colors to fit the harmony mode
  const setHarmonyMode = (mode: HarmonyMode) => {
    const isProHarmony = ["analogous", "complementary", "triadic", "tetradic", "split"].includes(mode);
    if (isProHarmony && userSubscription.tier === "free") {
      showToast(`The ${mode.toUpperCase()} harmony matches deep color science and is exclusive to PRO members.`, "error");
      setShowUpgradeModal(true);
      return;
    }

    setHarmonyState(mode);
    setColors((prev) => {
      // Find pivot color (first locked, or first color in list)
      const pivotIndex = prev.findIndex((c) => c.locked);
      const pivotHex = pivotIndex !== -1 ? prev[pivotIndex].hex : prev[0].hex;
      
      const existingHexes = new Set(prev.map(c => c.hex.toLowerCase()));
      const assignedInThisRun = new Set<string>();

      // Generate a pool of candidates
      const candidates = generateHarmony(mode, pivotHex, 50);

      return prev.map((item) => {
        if (item.locked) return item;

        let chosenHex = "";
        for (const cand of candidates) {
          const lowerCand = cand.toLowerCase();
          if (!existingHexes.has(lowerCand) && !assignedInThisRun.has(lowerCand)) {
            chosenHex = cand;
            break;
          }
        }

        if (!chosenHex) {
          let attempts = 0;
          while (attempts < 20) {
            const offsetH = Math.floor(Math.random() * 360);
            const offsetS = Math.floor(Math.random() * 40) - 20;
            const offsetL = Math.floor(Math.random() * 40) - 20;
            const randomHslOffset = offsetColor(rgbToHsl(hexToRgb(pivotHex)), offsetH, offsetS, offsetL);
            const lowerOffset = randomHslOffset.toLowerCase();
            if (!existingHexes.has(lowerOffset) && !assignedInThisRun.has(lowerOffset)) {
              chosenHex = randomHslOffset;
              break;
            }
            attempts++;
          }
        }

        if (!chosenHex) {
          let attempts = 0;
          while (attempts < 20) {
            const temp = getRandomHex();
            const lowerTemp = temp.toLowerCase();
            if (!existingHexes.has(lowerTemp) && !assignedInThisRun.has(lowerTemp)) {
              chosenHex = temp;
              break;
            }
            attempts++;
          }
        }

        if (!chosenHex) {
          chosenHex = getRandomHex();
        }

        assignedInThisRun.add(chosenHex.toLowerCase());
        return {
          ...item,
          hex: chosenHex,
        };
      });
    });
    showToast(`Harmony updated to ${mode}`, "info");
  };

  // Safe callback to update color code directly
  const updateColorIndex = (index: number, hex: string) => {
    // Basic hex sanitizer
    let sanitizedHex = hex;
    if (!sanitizedHex.startsWith("#")) {
      sanitizedHex = "#" + sanitizedHex;
    }

    setColors((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, hex: sanitizedHex };
        }
        return item;
      })
    );
  };

  // Safe callback to update color role
  const updateColorRole = (index: number, role: ColorRole) => {
    setColors((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, role };
        }
        return item;
      })
    );
  };

  // Toggle active lock
  const toggleColorLock = (index: number) => {
    setColors((prev) =>
      prev.map((item, idx) => {
        if (idx === index) {
          return { ...item, locked: !item.locked };
        }
        return item;
      })
    );
  };

  // Regenerate unlocked colors with dynamic and random elements
  const regenerateUnlocked = () => {
    setColors((prev) => {
      // Determine base anchor color for harmony mode
      const anchorIdx = prev.findIndex((c) => c.locked);
      const anchorHex = anchorIdx !== -1 ? prev[anchorIdx].hex : getRandomHex();
      
      const existingHexes = new Set(prev.map(c => c.hex.toLowerCase()));
      const assignedInThisRun = new Set<string>();

      // Generate a pool of candidates
      const candidates = generateHarmony(harmonyMode, anchorHex, 50);

      return prev.map((item) => {
        if (item.locked) return item;

        let chosenHex = "";
        for (const cand of candidates) {
          const lowerCand = cand.toLowerCase();
          if (!existingHexes.has(lowerCand) && !assignedInThisRun.has(lowerCand)) {
            chosenHex = cand;
            break;
          }
        }

        if (!chosenHex) {
          let attempts = 0;
          while (attempts < 20) {
            const offsetH = Math.floor(Math.random() * 360);
            const offsetS = Math.floor(Math.random() * 40) - 20;
            const offsetL = Math.floor(Math.random() * 40) - 20;
            const randomHslOffset = offsetColor(rgbToHsl(hexToRgb(anchorHex)), offsetH, offsetS, offsetL);
            const lowerOffset = randomHslOffset.toLowerCase();
            if (!existingHexes.has(lowerOffset) && !assignedInThisRun.has(lowerOffset)) {
              chosenHex = randomHslOffset;
              break;
            }
            attempts++;
          }
        }

        if (!chosenHex) {
          let attempts = 0;
          while (attempts < 20) {
            const temp = getRandomHex();
            const lowerTemp = temp.toLowerCase();
            if (!existingHexes.has(lowerTemp) && !assignedInThisRun.has(lowerTemp)) {
              chosenHex = temp;
              break;
            }
            attempts++;
          }
        }

        if (!chosenHex) {
          chosenHex = getRandomHex();
        }

        assignedInThisRun.add(chosenHex.toLowerCase());
        return {
          ...item,
          hex: chosenHex,
        };
      });
    });
  };

  const [isSpinning, setIsSpinning] = useState(false);
  const [previousColors, setPreviousColors] = useState<ColorItem[]>([]);

  const spinPalette = () => {
    regenerateUnlocked();
    showToast("Colors regenerated!", "info");
  };

  // Fetch Saved Palettes (Firestore or LocalStorage)
  const fetchPalettes = async () => {
    setLoadingPalettes(true);
    
    // Auth mode
    if (user && isFirebaseConfigured && db) {
      const qPath = "palettes";
      try {
        const palettesQuery = query(
          collection(db, qPath),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(palettesQuery);
        const dataList: Palette[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          dataList.push({
            id: docSnap.id,
            name: data.name,
            colors: data.colors,
            harmonyMode: data.harmonyMode || "random",
            userId: data.userId,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
          });
        });
        setSavedPalettes(dataList);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, qPath);
      } finally {
        setLoadingPalettes(false);
      }
    } else {
      // LocalStorage mode
      try {
        const localList = localStorage.getItem("palette_generator_saved");
        if (localList) {
          setSavedPalettes(JSON.parse(localList));
        } else {
          setSavedPalettes([]);
        }
      } catch (err) {
        console.error("Local storage read fail:", err);
      } finally {
        setLoadingPalettes(false);
      }
    }
  };

  useEffect(() => {
    fetchPalettes();
  }, [user]);

  // Auth Operations
  const loginWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      showToast("Firebase account simulation activated. Signed in under Local Guest mode.", "info");
      // Local Mock sign in
      setUser({
        uid: "local_sandbox_user",
        displayName: "Guest Designer",
        email: "guest@example.com",
        photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
      } as any);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Logged in successfully with Google!", "success");
    } catch (err) {
      console.error("Google Auth Fail:", err);
      showToast("Authentication interrupted", "error");
    }
  };

  // Friendly mapping for the most common Firebase Auth error codes.
  const authErrorMessage = (code: string): string => {
    switch (code) {
      case "auth/email-already-in-use":
        return "That email already has an account. Try signing in instead.";
      case "auth/invalid-email":
        return "That doesn't look like a valid email address.";
      case "auth/weak-password":
        return "Password is too weak — use at least 6 characters.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      default:
        return "Authentication failed. Please try again.";
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    if (!isFirebaseConfigured || !auth) {
      showToast("Account creation is unavailable right now.", "error");
      throw new Error("Auth not configured");
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (displayName && displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      try {
        await sendEmailVerification(cred.user);
      } catch {
        /* non-fatal — verification email is best-effort */
      }
      showToast("Account created! Check your inbox to verify your email.", "success");
    } catch (err: any) {
      const msg = authErrorMessage(err?.code || "");
      showToast(msg, "error");
      throw new Error(msg);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) {
      showToast("Sign-in is unavailable right now.", "error");
      throw new Error("Auth not configured");
    }
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast("Signed in successfully!", "success");
    } catch (err: any) {
      const msg = authErrorMessage(err?.code || "");
      showToast(msg, "error");
      throw new Error(msg);
    }
  };

  const sendReset = async (email: string) => {
    if (!isFirebaseConfigured || !auth) {
      showToast("Password reset is unavailable right now.", "error");
      throw new Error("Auth not configured");
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast("Password reset email sent. Check your inbox.", "success");
    } catch (err: any) {
      const msg = authErrorMessage(err?.code || "");
      showToast(msg, "error");
      throw new Error(msg);
    }
  };

  const logout = async () => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      setSavedPalettes([]);
      showToast("Signed out of local guest profile", "info");
      return;
    }
    try {
      await signOut(auth);
      setSavedPalettes([]);
      showToast("Logged out successfully", "success");
    } catch (err) {
      console.error("Logout Fail:", err);
      showToast("Logout failed", "error");
    }
  };

  // Add a Palette
  const saveCurrentPalette = async (name: string) => {
    if (userSubscription.tier === "free" && savedPalettes.length >= 2) {
      showToast("Free tier is limited to 2 saved palettes. Upgrade to PRO to save unlimited palettes!", "error");
      setShowUpgradeModal(true);
      return;
    }

    if (!name.trim()) {
      showToast("Palette name is required", "error");
      return;
    }

    const cleanName = name.trim().slice(0, 64);
    const userId = user ? user.uid : "local_guest";
    
    // Validate hex code integrity prior to DB write
    const colorsClean = currentColors.map((c) => ({
      hex: /^#[0-9A-F]{6}$/i.test(c.hex) ? c.hex : getRandomHex(),
      role: c.role,
      locked: c.locked,
    }));

    if (user && isFirebaseConfigured && db) {
      const qPath = "palettes";
      try {
        const paletteData = {
          userId,
          name: cleanName,
          harmonyMode,
          colors: colorsClean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (userSubscription.tier === "free") {
          // Free accounts own two fixed document slots; firestore.rules
          // rejects any other palette ID, which is what enforces the cap.
          const taken = new Set(savedPalettes.map((p) => p.id));
          const slotId = [`${userId}_slot1`, `${userId}_slot2`].find((id) => !taken.has(id));
          if (!slotId) {
            showToast("Free tier is limited to 2 saved palettes. Upgrade to PRO to save unlimited palettes!", "error");
            setShowUpgradeModal(true);
            return;
          }
          await setDoc(doc(db, qPath, slotId), paletteData);
        } else {
          await addDoc(collection(db, qPath), paletteData);
        }
        showToast("Palette saved directly to Firestore!", "success");
        await fetchPalettes();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, qPath);
      }
    } else {
      // Offline LocalStorage save
      try {
        const item: Palette = {
          id: "palette_" + Date.now(),
          name: cleanName,
          colors: colorsClean,
          harmonyMode,
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingListString = localStorage.getItem("palette_generator_saved");
        const existingList = existingListString ? JSON.parse(existingListString) : [];
        const newList = [item, ...existingList];
        
        localStorage.setItem("palette_generator_saved", JSON.stringify(newList));
        setSavedPalettes(newList);
        showToast("Palette saved locally to your browser!", "success");
      } catch (err) {
        console.error("Failed storing locally:", err);
        showToast("Saving failed", "error");
      }
    }
  };

  // Delete a Palette
  const deleteSavedPalette = async (paletteId: string) => {
    if (user && isFirebaseConfigured && db) {
      const qPath = `palettes/${paletteId}`;
      try {
        const ref = doc(db, "palettes", paletteId);
        await deleteDoc(ref);
        showToast("Palette deleted from cloud", "success");
        await fetchPalettes();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, qPath);
      }
    } else {
      // LocalStorage mode
      try {
        const existingListString = localStorage.getItem("palette_generator_saved");
        if (existingListString) {
          const list: Palette[] = JSON.parse(existingListString);
          const filtered = list.filter((p) => p.id !== paletteId);
          localStorage.setItem("palette_generator_saved", JSON.stringify(filtered));
          setSavedPalettes(filtered);
          showToast("Palette removed locally", "info");
        }
      } catch (err) {
        console.error("Local delete failed:", err);
      }
    }
  };

  // Load Palette
  const loadSavedPalette = (palette: Palette) => {
    setColors(palette.colors);
    setHarmonyState(palette.harmonyMode || "random");
    showToast(`Loaded palette "${palette.name}"`, "success");
  };

  const isDbActive = isFirebaseConfigured;

  return (
    <AppContext.Provider
      value={{
        user,
        loadingAuth,
        isDbActive,
        savedPalettes,
        loadingPalettes,
        currentColors,
        harmonyMode,
        notification,
        userSubscription,
        loadingSub,
        showUpgradeModal,
        setShowUpgradeModal,
        purchasePro,
        cancelSubscription,
        refreshSubscription,
        setColors,
        setHarmonyMode,
        updateColorIndex,
        updateColorRole,
        toggleColorLock,
        regenerateUnlocked,
        spinPalette,
        isSpinning,
        previousColors,
        undo,
        redo,
        canUndo,
        canRedo,
        addColumn,
        removeColumn,
        loginWithGoogle,
        registerWithEmail,
        loginWithEmail,
        sendReset,
        logout,
        saveCurrentPalette,
        deleteSavedPalette,
        loadSavedPalette,
        showToast,
        clearToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
