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
import { track } from "@amplitude/unified";
import { isAdminEmail } from "../legal";
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
import { getRandomHex, ColorRole } from "../utils/colorUtils";
import { generatePalette } from "../utils/paletteEngine";

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
  /** Opening it while signed out asks the visitor to sign in first, then continues. */
  setShowUpgradeModal: (show: boolean) => void;
  /** Which sign-in prompt is open, if any. "upgrade" means it leads on to checkout. */
  authPrompt: null | "signin" | "upgrade";
  openAuth: (reason?: "signin" | "upgrade") => void;
  closeAuth: () => void;
  // Real Square checkout: takes a tokenized card from the Web Payments SDK,
  // charges via the backend Cloud Function, then refreshes the local tier.
  purchasePro: (
    plan: 'monthly' | 'annual' | 'lifetime',
    token: string,
    verificationToken?: string,
    promoCode?: string
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
  respinColor: (index: number) => void;
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
  const [showUpgradeModal, setShowUpgradeModalState] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<null | "signin" | "upgrade">(null);
  // The account whose subscription has finished loading; used to wait for the
  // real tier before deciding whether a new sign-in still needs to upgrade.
  const [subLoadedFor, setSubLoadedFor] = useState<string | null>(null);
  const upgradeAfterSignIn = React.useRef(false);

  // A subscription belongs to an account, so a signed-out visitor who asks to
  // upgrade is taken to sign in or create an account first. Once they are in,
  // the upgrade screen opens by itself (see the effect further down).
  const setShowUpgradeModal = (show: boolean) => {
    if (show && isFirebaseConfigured && auth && !auth.currentUser) {
      upgradeAfterSignIn.current = true;
      setAuthPrompt("upgrade");
      return;
    }
    setShowUpgradeModalState(show);
  };
  const openAuth = (reason: "signin" | "upgrade" = "signin") => setAuthPrompt(reason);
  const closeAuth = () => {
    // Closed without signing in: drop the pending upgrade.
    if (!auth?.currentUser) upgradeAfterSignIn.current = false;
    setAuthPrompt(null);
  };

  // Default color palette setup initialized with brand colors: #1a1a1a, #d1c69e, #2589BD, #f4f4f4
  const [currentColors, setColorsState] = useState<ColorItem[]>([
    { hex: "#2589BD", role: "general", locked: false },
    { hex: "#d1c69e", role: "general", locked: false },
    { hex: "#f4f4f4", role: "general", locked: false },
    { hex: "#1a1a1a", role: "general", locked: false },
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
    // A signed-out visitor has no profile to read and is always on the free plan.
    if (isFirebaseConfigured && auth?.currentUser?.uid !== uid) {
      setUserSubscription({ tier: "free", updatedAt: new Date().toISOString() });
      setLoadingSub(false);
      setSubLoadedFor(uid);
      return;
    }
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
        setSubLoadedFor(uid);
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
        setSubLoadedFor(uid);
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

  // Continue to checkout after a sign-in that was started from an upgrade
  // button, once that account's real tier is known.
  useEffect(() => {
    if (!upgradeAfterSignIn.current || !user || subLoadedFor !== user.uid) return;
    upgradeAfterSignIn.current = false;
    setAuthPrompt(null);
    if (userSubscription.tier === "free") setShowUpgradeModalState(true);
    else showToast("This account already has Pro. You're all set.", "success");
  }, [user, subLoadedFor, userSubscription.tier]);

  // An admin account without a plan is comped by the server the first time it
  // is recognised. Ask once per sign-in, then re-read the plan.
  const adminCompAsked = React.useRef<string | null>(null);
  useEffect(() => {
    if (!user || subLoadedFor !== user.uid || userSubscription.tier !== "free") return;
    if (!isAdminEmail(user.email) || !functions || adminCompAsked.current === user.uid) return;
    adminCompAsked.current = user.uid;
    httpsCallable(functions, "adminApi")({ action: "whoami" })
      .then((res: any) => {
        if (res?.data?.comped) fetchSubscription(user.uid);
      })
      .catch(() => undefined);
  }, [user, subLoadedFor, userSubscription.tier]);

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
    verificationToken?: string,
    promoCode?: string
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
    const res: any = await callable({ plan, token, verificationToken, ...(promoCode ? { promoCode } : {}) });

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
      showToast("The free plan includes up to 5 swatches. Go Pro for up to 10.", "error");
      setShowUpgradeModal(true);
      return;
    }

    setColors((prev) => {
      if (prev.length >= 10) {
        showToast("A palette can have up to 10 swatches", "error");
        return prev;
      }
      
      // New colours start on General: the engine works out what the palette
      // still lacks. The user can pick a role afterwards to steer it.
      const chosenRole: ColorRole = "general";

      // Generate the new colour for its role, treating every existing colour
      // as fixed context so it is designed to sit with all of them.
      const draft: ColorItem[] = [...prev, { hex: "#808080", role: chosenRole, locked: false }];
      const newHex = generatePalette(draft, harmonyMode, {
        fixed: draft.map((_, i) => i < prev.length),
      })[prev.length];

      const updated = [
        ...prev,
        { hex: newHex, role: chosenRole, locked: false }
      ];
      showToast("Swatch added", "success");
      return updated;
    });
  };

  // Remove column strips element from index down to minimum of 2
  const removeColumn = (index: number) => {
    setColors((prev) => {
      if (prev.length <= 2) {
        showToast("A palette needs at least 2 colors", "error");
        return prev;
      }
      const updated = prev.filter((_, idx) => idx !== index);
      showToast("Swatch removed", "info");
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
    setColors((prev) => applyHexes(prev, generatePalette(prev, mode)));
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

  const applyHexes = (items: ColorItem[], hexes: string[]) =>
    items.map((item, i) => (item.hex === hexes[i] ? item : { ...item, hex: hexes[i] }));

  // Regenerate every unlocked colour. Each one is built for its role and
  // around all of the locked colours (see utils/paletteEngine).
  const regenerateUnlocked = () => {
    setColors((prev) => applyHexes(prev, generatePalette(prev, harmonyMode)));
  };

  // Regenerate one colour, keeping every other colour exactly as it is.
  const respinColor = (index: number) => {
    setColors((prev) =>
      applyHexes(prev, generatePalette(prev, harmonyMode, { fixed: prev.map((_, i) => i !== index) }))
    );
  };

  const [isSpinning, setIsSpinning] = useState(false);
  const [previousColors, setPreviousColors] = useState<ColorItem[]>([]);

  const spinPalette = () => {
    if (currentColors.every((c) => c.locked)) {
      showToast("Every color is locked. Unlock at least one to spin.", "info");
      return;
    }
    regenerateUnlocked();
    track("Palette Spun");
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
    // Saving to the library is a Pro feature (firestore.rules enforces it).
    if (userSubscription.tier === "free") {
      showToast("Saving palettes is a Pro feature. Go Pro to build your palette library.", "error");
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
        await addDoc(collection(db, qPath), paletteData);
        showToast("Palette saved to your library", "success");
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
        showToast("Palette saved to your library", "success");
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
        authPrompt,
        openAuth,
        closeAuth,
        purchasePro,
        cancelSubscription,
        refreshSubscription,
        setColors,
        setHarmonyMode,
        updateColorIndex,
        updateColorRole,
        toggleColorLock,
        regenerateUnlocked,
        respinColor,
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
