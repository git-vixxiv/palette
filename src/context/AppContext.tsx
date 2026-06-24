import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
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
import { 
  auth, 
  db, 
  googleProvider, 
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
  upgradeToPro: (plan: 'monthly' | 'annual' | 'lifetime') => Promise<void>;
  downgradeToFree: () => Promise<void>;

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

  // Fetch subscription tier status
  const fetchSubscription = async (uid: string) => {
    // Creator Auto-Unlock: Elevate developer/reviewer email from metadata immediately to lifetime premium status
    if (user && user.email === "jrozsa@gmail.com") {
      const adminSub: UserSubscription = {
        tier: "pro-lifetime",
        subscriptionId: "admin_lifetime",
        subscriptionStatus: "active",
        premiumExpires: new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString(),
        pricingPlan: "Lifetime Free Creator Status",
        updatedAt: new Date().toISOString()
      };
      setUserSubscription(adminSub);
      setLoadingSub(false);
      return;
    }

    setLoadingSub(true);
    if (isFirebaseConfigured && db) {
      try {
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserSubscription({
            tier: data.tier || "free",
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

  // Handle premium billing upgrades (monthly vs annual vs lifetime)
  const upgradeToPro = async (plan: 'monthly' | 'annual' | 'lifetime') => {
    let targetTier: "pro-monthly" | "pro-annual" | "pro-lifetime";
    let pricingText = "";
    const futureExpires = new Date();

    if (plan === "monthly") {
      targetTier = "pro-monthly";
      pricingText = "$5/mo";
      futureExpires.setMonth(futureExpires.getMonth() + 1);
    } else if (plan === "annual") {
      targetTier = "pro-annual";
      pricingText = "$25/yr";
      futureExpires.setFullYear(futureExpires.getFullYear() + 1);
    } else {
      targetTier = "pro-lifetime";
      pricingText = "$50 lifetime";
      futureExpires.setFullYear(futureExpires.getFullYear() + 100); // Practical lifetime mapping
    }

    const subId = "sub_" + Math.random().toString(36).substring(2, 10);

    const subData: UserSubscription = {
      tier: targetTier,
      subscriptionId: subId,
      subscriptionStatus: "active",
      premiumExpires: futureExpires.toISOString(),
      pricingPlan: pricingText,
      updatedAt: new Date().toISOString()
    };

    const uid = user ? user.uid : "local_guest";

    if (user && isFirebaseConfigured && db) {
      const qPath = `users/${uid}`;
      try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
          userId: uid,
          email: user.email || "",
          tier: targetTier,
          subscriptionId: subId,
          subscriptionStatus: "active",
          premiumExpires: futureExpires.toISOString(),
          pricingPlan: pricingText,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        setUserSubscription(subData);
        showToast(`Unlocked PRO mode! Subscribed to ${pricingText}. Welcome!`, "success");
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, qPath);
      }
    } else {
      try {
        localStorage.setItem(`palette_generator_sub_${uid}`, JSON.stringify(subData));
        setUserSubscription(subData);
        showToast(`Guest Upgraded to Pro successfully! (${pricingText})`, "success");
      } catch (err) {
        console.error("Failed local guest upgrade:", err);
      }
    }
    setShowUpgradeModal(false);
  };

  // Downgrade profile back to standard (allows users to toggle & test easily)
  const downgradeToFree = async () => {
    const subData: UserSubscription = {
      tier: "free",
      updatedAt: new Date().toISOString()
    };
    const uid = user ? user.uid : "local_guest";

    if (user && isFirebaseConfigured && db) {
      const qPath = `users/${uid}`;
      try {
        const userRef = doc(db, "users", uid);
        await setDoc(userRef, {
          userId: uid,
          tier: "free",
          subscriptionId: "",
          subscriptionStatus: "cancelled",
          premiumExpires: "",
          pricingPlan: "",
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        setUserSubscription(subData);
        showToast("Downgraded back to Standard Free Tier.", "info");
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, qPath);
      }
    } else {
      try {
        localStorage.setItem(`palette_generator_sub_${uid}`, JSON.stringify(subData));
        setUserSubscription(subData);
        showToast("Guest account returned to standard free limits", "info");
      } catch (err) {
        console.error("Local downgrade fail:", err);
      }
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
        await addDoc(collection(db, qPath), {
          userId,
          name: cleanName,
          harmonyMode,
          colors: colorsClean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
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
        upgradeToPro,
        downgradeToFree,
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
