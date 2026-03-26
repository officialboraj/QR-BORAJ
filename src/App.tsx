/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate, 
  useParams, 
  useLocation,
  Navigate
} from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  QrCode, LayoutDashboard, BarChart3, Plus, LogOut, Globe, CreditCard, FileText, Download, 
  MessageCircle, Mail, Wifi, Activity, Users, Sparkles, ChevronRight, Menu, X, AlertCircle, 
  CheckCircle2, Shield, Zap, Settings, ShoppingCart, Layers, MapPin, Smartphone, 
  Search, Filter, ArrowRight, Copy, Clock, Database, Share2, Trash2, Edit2, TrendingUp,
  Lock, Key, ZapOff, Gift, Star, Crown, Check, Info, ExternalLink, Phone, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, subDays, isSameDay, addMonths } from 'date-fns';
import confetti from 'canvas-confetti';
import JSZip from 'jszip';

import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
  collection, doc, getDoc, setDoc, updateDoc, query, where, onSnapshot, 
  serverTimestamp, orderBy, limit, addDoc
} from './firebase';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

interface ApiKey {
  id: string;
  key: string;
  name: string;
  createdAt: any;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user' | 'manager';
  subscription?: Subscription;
  apiKeys?: ApiKey[];
  thirdPartyKeys?: {
    payu?: { merchantId: string; salt: string; key: string; };
    razorpay?: { keyId: string; keySecret: string; };
  };
  createdAt: any;
}

interface Subscription {
  planId: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'pending' | 'expired';
  startDate: any;
  endDate: any;
  trialUsed: boolean;
}

interface QRCodeData {
  id: string;
  ownerId: string;
  type: 'url' | 'wifi' | 'upi' | 'whatsapp' | 'email' | 'vcard' | 'location' | 'pdf' | 'app';
  content: string;
  title: string;
  style: {
    fgColor: string;
    bgColor: string;
    level: 'L' | 'M' | 'Q' | 'H';
    size: number;
    logo?: string;
    shape?: 'square' | 'circle';
  };
  isDynamic: boolean;
  redirectUrl?: string;
  scanCount: number;
  createdAt: any;
  campaignId?: string;
}

interface ScanEvent {
  qrId: string;
  timestamp: any;
  ip: string;
  device: string;
  os: string;
  browser: string;
  country: string;
  city: string;
  referrer: string;
}

interface Campaign {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: any;
  qrCount: number;
  totalScans: number;
}

interface PromoCode {
  id: string;
  code: string;
  discount: number;
  isActive: boolean;
}

// --- Utils ---

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const REDIRECT_BASE_URL = window.location.origin;

const PLANS = [
  { id: 'free', name: 'Free', price: '₹0', features: ['Basic QR', 'PNG Download', '10 Scans/mo'], color: 'bg-slate-500' },
  { id: 'pro', name: 'Pro', price: '₹99/mo', features: ['Dynamic QR', 'Logo Inside', 'SVG/EPS Export', 'Analytics', '1000 Scans/mo'], color: 'bg-indigo-600' },
  { id: 'enterprise', name: 'Enterprise', price: '₹499/mo', features: ['Bulk QR', 'White Label', 'API Access', 'Geo-Redirect', 'Unlimited Scans'], color: 'bg-emerald-600' },
];

// --- Components ---

const Button = ({ 
  children, className, variant = 'primary', size = 'md', ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'premium', size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
    outline: 'border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    premium: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-md',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button 
      className={cn('inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm', className)} {...props}>
    {children}
  </div>
);

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    className={cn('w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm', className)}
    {...props}
  />
);

const downloadQR = (id: string, fileName: string) => {
  const svg = document.getElementById(id) as unknown as SVGElement | null;
  if (!svg) {
    console.error('SVG not found');
    return;
  }
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const svgSize = svg.getBoundingClientRect();
  
  // Use a fixed high resolution for download
  const downloadSize = 1024;
  canvas.width = downloadSize;
  canvas.height = downloadSize;
  
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    if (ctx) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${fileName.replace(/\s+/g, '_').toLowerCase()}_qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    }
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
};

// --- Layout ---

const Navbar = ({ user, onLogout }: { user: UserProfile | null, onLogout: () => void }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Generator', path: '/generator', icon: QrCode },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Campaigns', path: '/campaigns', icon: Globe },
    { name: 'API Settings', path: '/api-settings', icon: Key },
    { name: 'Subscription', path: '/subscription', icon: Crown },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">QR Boraj <span className="text-indigo-600">Quantum</span></span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link 
                key={item.name} 
                to={item.path}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                  location.pathname === item.path ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {user.subscription?.planId || 'Free'}
                  </p>
                </div>
                <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                <Button variant="ghost" size="sm" onClick={onLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Link to="/login">
                <Button size="sm">Login</Button>
              </Link>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-slate-200 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navItems.map((item) => (
                <Link 
                  key={item.name} 
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "block px-4 py-3 rounded-lg text-base font-medium flex items-center gap-3",
                    location.pathname === item.path ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              ))}
              {user && (
                <div className="pt-4 mt-4 border-t border-slate-200">
                  <button 
                    onClick={() => { onLogout(); setIsMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-red-600 font-medium flex items-center gap-3"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Views ---

const LoginPage = () => {
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'promocodes'), where('isActive', '==', true), limit(1));
    onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setPromo({ id: snap.docs[0].id, ...snap.docs[0].data() } as PromoCode);
      }
    });
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'user',
          subscription: {
            planId: 'free',
            status: 'active',
            startDate: serverTimestamp(),
            endDate: null,
            trialUsed: false
          },
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setOtpSent(true);
      alert('OTP sent! Since this is a demo, please check the browser console (F12 -> Console) or server logs to see the OTP code.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 1. Verify OTP via server
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid OTP');

      // 2. Proceed with Firebase Auth
      // Note: In a real production app, you'd use Firebase Custom Tokens here.
      // For this demo, we'll proceed with the email/password auth if it exists,
      // or create a dummy password for OTP-only users.
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password || 'OTP_USER_' + Math.random());
        await updateProfile(result.user, { displayName });
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: displayName,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
          role: 'user',
          subscription: {
            planId: 'free',
            status: 'active',
            startDate: serverTimestamp(),
            endDate: null,
            trialUsed: false
          },
          createdAt: serverTimestamp()
        });
      } else {
        // For login, we still need the password if using standard Email/Password provider.
        // If the user only has OTP, you'd typically use passwordless login or custom tokens.
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useOtp && !otpSent) {
      handleSendOtp();
      return;
    }
    if (useOtp && otpSent) {
      handleVerifyOtpAndAuth(e);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        const userRef = doc(db, 'users', result.user.uid);
        await setDoc(userRef, {
          uid: result.user.uid,
          email: result.user.email,
          displayName: displayName,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
          role: 'user',
          subscription: {
            planId: 'free',
            status: 'active',
            startDate: serverTimestamp(),
            endDate: null,
            trialUsed: false
          },
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email to reset password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-slate-50 p-4">
      {promo && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3"
        >
          <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          <span className="font-bold">FLASH OFFER: Use code {promo.code} for {promo.discount}% OFF!</span>
        </motion.div>
      )}
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">QR Boraj Quantum</h1>
          <p className="text-slate-500">80+ Smart Points Ecosystem</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          {isSignUp && (
            <Input 
              placeholder="Full Name" 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              required 
            />
          )}
          <Input 
            type="email" 
            placeholder="Email Address" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            disabled={otpSent}
          />
          {!otpSent && (
            <Input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required={!useOtp} 
            />
          )}
          {otpSent && (
            <div className="space-y-2">
              <Input 
                placeholder="Enter 6-digit OTP" 
                value={otpCode} 
                onChange={e => setOtpCode(e.target.value)} 
                required 
                maxLength={6}
              />
              <p className="text-[10px] text-slate-500 text-center">OTP sent to your email.</p>
            </div>
          )}
          <Button type="submit" className="w-full py-3" disabled={loading}>
            {loading ? 'Processing...' : (
              otpSent ? 'Verify & Continue' : (useOtp ? 'Send OTP' : (isSignUp ? 'Create Account' : 'Sign In'))
            )}
          </Button>
        </form>

        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setOtpSent(false);
                setUseOtp(false);
              }} 
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
            {!isSignUp && !otpSent && (
              <button 
                onClick={handleForgotPassword}
                className="text-sm font-medium text-slate-500 hover:text-slate-600"
              >
                Forgot Password?
              </button>
            )}
          </div>
          
          <button 
            onClick={() => {
              setUseOtp(!useOtp);
              setOtpSent(false);
            }}
            className="text-xs font-bold text-center text-indigo-500 hover:text-indigo-600 uppercase tracking-wider"
          >
            {useOtp ? 'Use Password instead' : 'Login with Email OTP'}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-500">Or continue with</span></div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleGoogleLogin} 
          className="w-full py-3 flex items-center justify-center gap-3" 
          disabled={loading}
        >
          <Globe className="w-5 h-5" />
          Google
        </Button>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-4 grayscale opacity-50">
          <Database className="w-5 h-5" />
          <Shield className="w-5 h-5" />
          <Zap className="w-5 h-5" />
          <Activity className="w-5 h-5" />
        </div>
      </Card>
    </div>
  );
};

const SubscriptionPage = ({ user }: { user: UserProfile }) => {
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<any>(null);

  const handleApplyPromo = () => {
    setPromoError(null);
    const code = promoCode.toUpperCase().trim();
    if (code === 'FREE1MONTH') {
      setAppliedPromo({ type: 'trial', duration: 1, planId: 'pro' });
      alert('Promo code applied: 1 Month Free Pro Trial!');
    } else if (code === 'ENTERPRISE_TRIAL') {
      setAppliedPromo({ type: 'trial', duration: 1, planId: 'enterprise' });
      alert('Promo code applied: 1 Month Free Enterprise Trial!');
    } else {
      setPromoError('Invalid or expired promo code.');
    }
  };

  const handleUpgrade = async (planId: string, isTrial = false) => {
    setLoading(true);
    try {
      if (!isTrial) {
        // Mock PayU Integration
        console.log(`[PAYU] Initializing payment for ${planId}...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log(`[PAYU] Payment successful!`);
      }
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        subscription: {
          planId,
          status: 'active',
          startDate: serverTimestamp(),
          endDate: addMonths(new Date(), 12), // Annual plan
          trialUsed: isTrial ? true : (user.subscription?.trialUsed || false)
        }
      });
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
      alert(`Success! You are now subscribed to the ${planId.toUpperCase()} plan via PayU${isTrial ? ' (Trial)' : ''}.`);
    } catch (error) {
      console.error('Upgrade error:', error);
      alert("Subscription update failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Choose Your Quantum Plan</h1>
        <p className="text-slate-500">Scale your QR ecosystem with professional tools.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {PLANS.map((plan) => (
          <Card key={plan.id} className={cn("p-8 flex flex-col", user.subscription?.planId === plan.id && "ring-2 ring-indigo-600")}>
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-6 text-white", plan.color)}>
              {plan.id === 'free' ? <ZapOff className="w-6 h-6" /> : plan.id === 'pro' ? <Star className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
            </div>
            <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
            <p className="text-3xl font-bold mb-6">{plan.price}</p>
            <ul className="space-y-4 mb-8 flex-grow">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="w-4 h-4 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="space-y-3">
              <Button 
                variant={plan.id === 'free' ? 'outline' : 'premium'} 
                className="w-full"
                disabled={user.subscription?.planId === plan.id || loading}
                onClick={() => handleUpgrade(plan.id)}
              >
                {user.subscription?.planId === plan.id ? 'Current Plan' : 'Select Plan'}
              </Button>
              {plan.id !== 'free' && !user.subscription?.trialUsed && (
                <Button 
                  variant="outline" 
                  className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  onClick={() => handleUpgrade(plan.id, true)}
                  disabled={loading}
                >
                  Start 1-Month Free Trial
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-8 mb-12 bg-slate-50 border-dashed border-2">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-grow">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Have an Offer Code?</h3>
            <p className="text-sm text-slate-500">Enter your code below to unlock special trials or discounts.</p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-grow md:w-64">
              <Input 
                placeholder="Enter Code (e.g. FREE1MONTH)" 
                value={promoCode} 
                onChange={e => setPromoCode(e.target.value)}
                className="pr-10"
              />
              <Gift className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <Button onClick={handleApplyPromo}>Apply</Button>
          </div>
        </div>
        {promoError && <p className="text-xs text-red-500 mt-2">{promoError}</p>}
        {appliedPromo && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-900">
                Applied: 1 Month Free {appliedPromo.planId.toUpperCase()} Trial
              </p>
            </div>
            <Button size="sm" onClick={() => handleUpgrade(appliedPromo.planId, true)}>Claim Now</Button>
          </div>
        )}
      </Card>

      <div className="mt-12 p-8 bg-indigo-50 rounded-2xl border border-indigo-100">
        <div className="flex items-center gap-4 mb-4">
          <Info className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-indigo-900">Subscription Status</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-bold uppercase text-indigo-400">Current Plan</p>
            <p className="text-lg font-bold text-indigo-900 capitalize">{user.subscription?.planId || 'Free'}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-indigo-400">Status</p>
            <p className="text-lg font-bold text-indigo-900 capitalize">{user.subscription?.status || 'Active'}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-indigo-400">Expires On</p>
            <p className="text-lg font-bold text-indigo-900">
              {user.subscription?.endDate ? format(user.subscription.endDate.toDate(), 'MMM dd, yyyy') : 'Never'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user }: { user: UserProfile }) => {
  const navigate = useNavigate();
  const [qrs, setQrs] = useState<QRCodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'qrcodes'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QRCodeData));
      setQrs(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [user.uid]);

  const handleGenerateAISuggestions = async () => {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 5 high-converting, catchy call-to-action (CTA) ideas for a QR code marketing campaign. 
        Include ideas like:
        1. Scan to Unlock Your Secret Discount
        2. Scan for Instant VIP Access
        3. Scan to See the Magic Happen
        The CTAs should be short, catchy, and encourage immediate scanning. Provide the output as a numbered list.`,
        config: {
          systemInstruction: "You are a professional marketing copywriter specializing in QR code campaigns for the QR Boraj Quantum platform.",
        }
      });
      setAiSuggestion(response.text || "1. Scan to Unlock Your Secret Discount\n2. Scan for Instant VIP Access\n3. Scan to See the Magic Happen");
    } catch (error) {
      console.error('AI Error:', error);
      setAiSuggestion("Scan to discover something amazing!");
    } finally {
      setAiLoading(false);
    }
  };

  const stats = [
    { name: 'Total QR Codes', value: qrs.length, icon: QrCode, color: 'bg-blue-500' },
    { name: 'Total Scans', value: qrs.reduce((acc, qr) => acc + (qr.scanCount || 0), 0), icon: Activity, color: 'bg-emerald-500' },
    { name: 'Unique Visitors', value: 0, icon: Users, color: 'bg-orange-500' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome back, {user.displayName.split(' ')[0]}!</h1>
          <p className="text-slate-500">Manage your 80+ Smart Points QR ecosystem.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/generator">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New QR
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.name} className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl text-white', stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Recent QR Codes</h2>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-lg" />)}
              </div>
            ) : qrs.length > 0 ? (
              <div className="space-y-4">
                {qrs.slice(0, 5).map((qr) => (
                  <div key={qr.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <QRCodeSVG 
                          id={`qr-svg-${qr.id}`}
                          value={qr.isDynamic ? `${REDIRECT_BASE_URL}/s/${qr.id}` : qr.content} 
                          size={40} 
                          fgColor={qr.style?.fgColor || '#000000'}
                          bgColor={qr.style?.bgColor || '#ffffff'}
                          imageSettings={qr.style?.logo ? {
                            src: qr.style.logo,
                            x: undefined,
                            y: undefined,
                            height: 10,
                            width: 10,
                            excavate: true,
                          } : undefined}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{qr.title || 'Untitled QR'}</h3>
                        <p className="text-xs text-slate-500 capitalize">{qr.type} • {qr.scanCount || 0} scans</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to={`/analytics/${qr.id}`}>
                        <Button variant="ghost" size="sm"><BarChart3 className="w-4 h-4" /></Button>
                      </Link>
                      {qr.isDynamic && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            navigator.clipboard.writeText(`${REDIRECT_BASE_URL}/s/${qr.id}`);
                            alert('Dynamic link copied to clipboard!');
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => downloadQR(`qr-svg-${qr.id}`, qr.title || 'qrcode')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No QR codes yet. Create your first one!</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              <h3 className="font-bold">AI Marketing Assistant</h3>
            </div>
            {aiSuggestion ? (
              <div className="bg-white/10 p-4 rounded-xl mb-4 text-xs italic leading-relaxed">
                {aiSuggestion}
              </div>
            ) : (
              <p className="text-sm text-indigo-100 mb-4">Need a high-converting CTA for your QR campaign?</p>
            )}
            <Button 
              variant="ghost" 
              className="w-full bg-white/10 hover:bg-white/20 text-white border-none text-xs"
              onClick={handleGenerateAISuggestions}
              disabled={aiLoading}
            >
              {aiLoading ? 'Thinking...' : aiSuggestion ? 'Regenerate Suggestions' : 'Generate AI Suggestions'}
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="font-bold mb-4">Quick Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-col gap-1 h-auto py-3"
                onClick={() => navigate('/generator', { state: { type: 'wifi' } })}
              >
                <Wifi className="w-4 h-4" />
                <span className="text-[10px]">WiFi</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-col gap-1 h-auto py-3"
                onClick={() => navigate('/generator', { state: { type: 'upi' } })}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[10px]">UPI</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-col gap-1 h-auto py-3"
                onClick={() => navigate('/generator', { state: { type: 'whatsapp' } })}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-[10px]">WhatsApp</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-col gap-1 h-auto py-3"
                onClick={() => navigate('/generator', { state: { type: 'pdf' } })}
              >
                <FileText className="w-4 h-4" />
                <span className="text-[10px]">PDF</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Generator = ({ user }: { user: UserProfile }) => {
  const location = useLocation();
  const [type, setType] = useState<QRCodeData['type']>(location.state?.type || 'url');
  const [title, setTitle] = useState('');
  const [isDynamic, setIsDynamic] = useState(false);
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [logo, setLogo] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Type-specific states
  const [url, setUrl] = useState('');
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiAuth, setWifiAuth] = useState('WPA');
  const [upiId, setUpiId] = useState('');
  const [upiName, setUpiName] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waMessage, setWaMessage] = useState('');
  const [emailAddr, setEmailAddr] = useState('');
  const [emailSub, setEmailSub] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [vcardName, setVcardName] = useState('');
  const [vcardPhone, setVcardPhone] = useState('');
  const [vcardEmail, setVcardEmail] = useState('');
  const [vcardOrg, setVcardOrg] = useState('');
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const isPro = user.subscription?.planId === 'pro' || user.subscription?.planId === 'enterprise';

  const getFormattedContent = () => {
    switch (type) {
      case 'url': return url;
      case 'wifi': return `WIFI:S:${wifiSSID};T:${wifiAuth};P:${wifiPass};;`;
      case 'upi': return `upi://pay?pa=${upiId}&pn=${upiName}${upiAmount ? `&am=${upiAmount}` : ''}&cu=INR`;
      case 'whatsapp': return `https://wa.me/${waPhone.replace(/\D/g, '')}${waMessage ? `?text=${encodeURIComponent(waMessage)}` : ''}`;
      case 'email': return `mailto:${emailAddr}?subject=${encodeURIComponent(emailSub)}&body=${encodeURIComponent(emailBody)}`;
      case 'vcard': return `BEGIN:VCARD\nVERSION:3.0\nFN:${vcardName}\nTEL:${vcardPhone}\nEMAIL:${vcardEmail}\nORG:${vcardOrg}\nEND:VCARD`;
      case 'location': return `geo:${locLat},${locLng}`;
      case 'pdf': return pdfUrl;
      default: return '';
    }
  };

  const content = getFormattedContent();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Logo size should be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (location.state?.type) {
      setType(location.state.type);
    }
  }, [location.state]);

  useEffect(() => {
    const q = query(collection(db, 'campaigns'), where('ownerId', '==', user.uid));
    return onSnapshot(q, (s) => setCampaigns(s.docs.map(d => ({ id: d.id, ...d.data() } as Campaign))));
  }, [user.uid]);

  const handleCreate = async () => {
    if (!content) return;
    
    // Basic validation
    if (type === 'url' && !url) return alert('Please enter a URL');
    if (type === 'wifi' && !wifiSSID) return alert('Please enter a WiFi SSID');
    if (type === 'upi' && !upiId) return alert('Please enter a UPI ID');
    if (type === 'whatsapp' && !waPhone) return alert('Please enter a WhatsApp number');
    if (type === 'email' && !emailAddr) return alert('Please enter an email address');
    if (type === 'vcard' && !vcardName) return alert('Please enter a name for the vCard');
    if (type === 'location' && (!locLat || !locLng)) return alert('Please enter coordinates');
    if (type === 'pdf' && !pdfUrl) return alert('Please enter a PDF URL');

    setLoading(true);
    try {
      const qrId = Math.random().toString(36).substring(2, 15);
      const qrData: Partial<QRCodeData> = {
        id: qrId,
        ownerId: user.uid,
        type,
        content,
        title: title || `${type.toUpperCase()} QR`,
        style: { fgColor, bgColor, level: 'H', size: 256, logo: logo || null },
        isDynamic: isPro ? isDynamic : false,
        redirectUrl: (isPro && isDynamic) ? content : null,
        scanCount: 0,
        campaignId: campaignId || null,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'qrcodes', qrId), qrData);

      if (campaignId) {
        const campRef = doc(db, 'campaigns', campaignId);
        const campSnap = await getDoc(campRef);
        if (campSnap.exists()) {
          await updateDoc(campRef, { qrCount: (campSnap.data().qrCount || 0) + 1 });
        }
      }

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      navigate('/');
    } catch (error) {
      console.error('Create QR error:', error);
      alert('Failed to create QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">QR Generator</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">QR Type</label>
            <div className="grid grid-cols-4 gap-2">
              {['url', 'wifi', 'upi', 'whatsapp', 'email', 'vcard', 'location', 'pdf'].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t as any)}
                  className={cn(
                    "p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                    type === t ? "bg-indigo-50 border-indigo-500 text-indigo-600" : "bg-white border-slate-200 text-slate-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Input placeholder="Title (Internal Use)" value={title} onChange={e => setTitle(e.target.value)} />
          
          <div className="space-y-4">
            {type === 'url' && (
              <Input placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} />
            )}
            
            {type === 'wifi' && (
              <div className="space-y-3">
                <Input placeholder="WiFi Name (SSID)" value={wifiSSID} onChange={e => setWifiSSID(e.target.value)} />
                <Input placeholder="Password" type="password" value={wifiPass} onChange={e => setWifiPass(e.target.value)} />
                <select 
                  value={wifiAuth} 
                  onChange={e => setWifiAuth(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none"
                >
                  <option value="WPA">WPA/WPA2</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">No Password</option>
                </select>
              </div>
            )}

            {type === 'upi' && (
              <div className="space-y-3">
                <Input placeholder="UPI ID (e.g. name@bank)" value={upiId} onChange={e => setUpiId(e.target.value)} />
                <Input placeholder="Payee Name" value={upiName} onChange={e => setUpiName(e.target.value)} />
                <Input placeholder="Amount (Optional)" type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} />
              </div>
            )}

            {type === 'whatsapp' && (
              <div className="space-y-3">
                <Input placeholder="Phone Number (with country code)" value={waPhone} onChange={e => setWaPhone(e.target.value)} />
                <textarea 
                  placeholder="Pre-filled Message" 
                  value={waMessage} 
                  onChange={e => setWaMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none min-h-[80px]"
                />
              </div>
            )}

            {type === 'email' && (
              <div className="space-y-3">
                <Input placeholder="Email Address" value={emailAddr} onChange={e => setEmailAddr(e.target.value)} />
                <Input placeholder="Subject" value={emailSub} onChange={e => setEmailSub(e.target.value)} />
                <textarea 
                  placeholder="Body Content" 
                  value={emailBody} 
                  onChange={e => setEmailBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm outline-none min-h-[80px]"
                />
              </div>
            )}

            {type === 'vcard' && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Full Name" value={vcardName} onChange={e => setVcardName(e.target.value)} className="col-span-2" />
                <Input placeholder="Phone" value={vcardPhone} onChange={e => setVcardPhone(e.target.value)} />
                <Input placeholder="Email" value={vcardEmail} onChange={e => setVcardEmail(e.target.value)} />
                <Input placeholder="Organization" value={vcardOrg} onChange={e => setVcardOrg(e.target.value)} className="col-span-2" />
              </div>
            )}

            {type === 'location' && (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Latitude" value={locLat} onChange={e => setLocLat(e.target.value)} />
                <Input placeholder="Longitude" value={locLng} onChange={e => setLocLng(e.target.value)} />
              </div>
            )}

            {type === 'pdf' && (
              <div className="space-y-3">
                <Input placeholder="PDF URL (or upload below)" value={pdfUrl} onChange={e => setPdfUrl(e.target.value)} />
                <p className="text-[10px] text-slate-400 italic">Pro Tip: Upload your PDF to a cloud drive and paste the direct link here.</p>
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Assign to Campaign</label>
            <select 
              value={campaignId} 
              onChange={e => setCampaignId(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="">None (Standalone QR)</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div className={cn("flex items-center justify-between p-4 rounded-xl border", isPro ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-100 opacity-60")}>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-indigo-900">Dynamic QR Code</p>
                {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
              </div>
              <p className="text-xs text-indigo-700">Change link later without re-printing.</p>
            </div>
            <button 
              onClick={() => isPro && setIsDynamic(!isDynamic)} 
              className={cn("w-12 h-6 rounded-full relative transition-colors", isDynamic ? "bg-indigo-600" : "bg-slate-300", !isPro && "cursor-not-allowed")}
            >
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", isDynamic ? "left-7" : "left-1")} />
            </button>
          </div>
          {!isDynamic && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <Info className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-[10px] text-amber-700 leading-relaxed">
                <strong>Static QR:</strong> Scans are NOT tracked. The content is hardcoded into the QR. 
                Enable <strong>Dynamic QR</strong> for analytics and tracking.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Foreground</label>
              <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Background</label>
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
          </div>

          <div className={cn("p-4 rounded-xl border", isPro ? "bg-indigo-50 border-indigo-100" : "bg-slate-50 border-slate-100 opacity-60")}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-indigo-900">Add Logo</p>
                  {!isPro && <Lock className="w-3 h-3 text-slate-400" />}
                </div>
                <p className="text-xs text-indigo-700">Upload your brand logo (PNG/JPG).</p>
              </div>
              <input 
                type="file" 
                id="logo-upload" 
                accept="image/*" 
                className="hidden" 
                onChange={handleLogoUpload}
                disabled={!isPro}
              />
              <label 
                htmlFor="logo-upload" 
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all",
                  isPro ? "bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {logo ? 'Change Logo' : 'Upload Logo'}
              </label>
            </div>
            {logo && (
              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100">
                <div className="flex items-center gap-2">
                  <img src={logo} alt="Logo preview" className="w-8 h-8 rounded object-contain" />
                  <span className="text-[10px] text-slate-500">Logo Attached</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLogo(null)} className="text-red-500 h-6 w-6 p-0">
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <Button className="w-full py-4 text-lg" onClick={handleCreate} disabled={loading || !content}>
            {loading ? 'Creating...' : 'Generate QR Code'}
          </Button>
          {!content && (
            <p className="text-xs text-amber-600 text-center mt-2 font-medium">
              Please enter a {type.toUpperCase()} to generate your QR code.
            </p>
          )}
        </Card>
        
        <div className="space-y-6">
          <Card className="p-8 flex flex-col items-center justify-center bg-slate-50 border-dashed border-2 border-slate-300">
            <div className="bg-white p-8 rounded-2xl shadow-xl mb-6">
              <QRCodeSVG 
                id="preview-qr-svg"
                value={content || REDIRECT_BASE_URL} 
                size={256} 
                fgColor={fgColor} 
                bgColor={bgColor} 
                includeMargin 
                imageSettings={logo ? {
                  src: logo,
                  x: undefined,
                  y: undefined,
                  height: 60,
                  width: 60,
                  excavate: true,
                } : undefined}
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-bold text-slate-900">Live Preview</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => downloadQR('preview-qr-svg', title || 'preview')}
                disabled={!content}
              >
                <Download className="w-4 h-4" />
                Download Preview
              </Button>
            </div>
          </Card>
          
          {!isPro && (
            <Card className="p-6 bg-amber-50 border border-amber-200">
              <div className="flex gap-3">
                <Zap className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Upgrade to Pro</p>
                  <p className="text-xs text-amber-700 mb-3">Unlock Dynamic QRs, custom logos, and high-quality exports.</p>
                  <Link to="/subscription">
                    <Button size="sm" variant="outline" className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100">View Plans</Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const Analytics = ({ user }: { user: UserProfile }) => {
  const { qrId } = useParams();
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [qr, setQr] = useState<QRCodeData | null>(null);

  useEffect(() => {
    if (!qrId) return;
    getDoc(doc(db, 'qrcodes', qrId)).then(s => s.exists() && setQr(s.data() as QRCodeData));
    const q = query(collection(db, 'scans'), where('qrId', '==', qrId), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (s) => {
      setScans(s.docs.map(d => d.data() as ScanEvent));
    }, (error) => {
      console.error('Analytics Snapshot Error:', error);
    });
  }, [qrId]);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      return {
        date: format(date, 'MMM dd'),
        count: scans.filter(s => isSameDay(s.timestamp?.toDate() || new Date(), date)).length
      };
    }).reverse();
  }, [scans]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{qr?.title || 'Analytics'}</h1>
          <p className="text-slate-500">Real-time scan tracking and audience insights.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => qr && downloadQR('analytics-qr-svg', qr.title || 'analytics')}
            disabled={!qr}
          >
            <Download className="w-4 h-4" />
            Download QR
          </Button>
          <Button variant="outline" className="gap-2">
            <FileText className="w-4 h-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Hidden QR for analytics download */}
      {qr && (
        <div className="hidden">
          <QRCodeSVG 
            id="analytics-qr-svg"
            value={qr.isDynamic ? `${REDIRECT_BASE_URL}/s/${qr.id}` : qr.content} 
            size={512} 
            fgColor={qr.style?.fgColor || '#000000'}
            bgColor={qr.style?.bgColor || '#ffffff'}
            includeMargin
            imageSettings={qr.style?.logo ? {
              src: qr.style.logo,
              x: undefined,
              y: undefined,
              height: 120,
              width: 120,
              excavate: true,
            } : undefined}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-bold mb-6">Scan Performance (Last 7 Days)</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fill="#6366f1" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Quick Stats</h2>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 font-bold uppercase">Total Scans</p>
                <p className="text-2xl font-bold">{scans.length}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 font-bold uppercase">Unique Devices</p>
                <p className="text-2xl font-bold">{new Set(scans.map(s => s.ip)).size}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">Geo Tracking</h2>
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg text-indigo-700">
              <MapPin className="w-5 h-5" />
              <span className="text-sm font-medium">India: {scans.filter(s => s.country === 'India').length} scans</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Campaigns = ({ user }: { user: UserProfile }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'campaigns'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (s) => {
      setCampaigns(s.docs.map(d => ({ id: d.id, ...d.data() } as Campaign)));
      setLoading(false);
    });
  }, [user.uid]);

  const handleCreate = async () => {
    if (!newName) return;
    try {
      const id = Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'campaigns', id), {
        id,
        ownerId: user.uid,
        name: newName,
        description: newDesc,
        createdAt: serverTimestamp(),
        qrCount: 0,
        totalScans: 0
      });
      setIsCreating(false);
      setNewName('');
      setNewDesc('');
      confetti({ particleCount: 50, spread: 60 });
    } catch (error) {
      console.error('Create campaign error:', error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Campaigns</h1>
          <p className="text-slate-500">Group your QR codes and track aggregated performance.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8"
          >
            <Card className="p-6 border-indigo-200 bg-indigo-50/30">
              <h3 className="font-bold mb-4">Create New Campaign</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <Input placeholder="Campaign Name" value={newName} onChange={e => setNewName(e.target.value)} />
                <Input placeholder="Description (Optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newName}>Create Campaign</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-xl" />)}
        </div>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <Card key={c.id} className="p-6 hover:border-indigo-300 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Layers className="w-5 h-5" />
                </div>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{c.name}</h3>
              <p className="text-xs text-slate-500 mb-6 line-clamp-2">{c.description || 'No description provided.'}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">QR Codes</p>
                  <p className="text-lg font-bold text-slate-900">{c.qrCount || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Total Scans</p>
                  <p className="text-lg font-bold text-slate-900">{c.totalScans || 0}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border-dashed border-2">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Campaigns Yet</h3>
          <p className="text-slate-500 mb-6">Create a campaign to group your QR codes and see combined analytics.</p>
          <Button onClick={() => setIsCreating(true)}>Create Your First Campaign</Button>
        </Card>
      )}
    </div>
  );
};

const RedirectHandler = () => {
  const { qrId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    if (!qrId) return;
    getDoc(doc(db, 'qrcodes', qrId)).then(async (snap) => {
      if (!snap.exists()) return setError('QR not found');
      const data = snap.data() as QRCodeData;
      setQrData(data);
      
      // Track scan
      await addDoc(collection(db, 'scans'), {
        qrId, timestamp: serverTimestamp(),
        device: /Mobile/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        os: /iPhone|iPad/i.test(navigator.userAgent) ? 'iOS' : /Android/i.test(navigator.userAgent) ? 'Android' : 'Desktop',
        ip: '127.0.0.1', // Mocked
        country: 'India', // Mocked
      });
      
      await updateDoc(doc(db, 'qrcodes', qrId), { scanCount: (data.scanCount || 0) + 1 });
      
      if (data.campaignId) {
        const campRef = doc(db, 'campaigns', data.campaignId);
        const campSnap = await getDoc(campRef);
        if (campSnap.exists()) {
          await updateDoc(campRef, { totalScans: (campSnap.data().totalScans || 0) + 1 });
        }
      }
      
      if (data.isDynamic && data.redirectUrl) {
        if (data.type === 'url') {
          window.location.href = data.redirectUrl;
        } else {
          setIsRedirecting(false);
        }
      } else {
        // For static QRs, we still want to show the details if scanned via our platform
        setIsRedirecting(false);
      }
    });
  }, [qrId]);

  const renderContentDetails = () => {
    if (!qrData) return null;
    const content = qrData.content;

    switch (qrData.type) {
      case 'wifi':
        const ssidMatch = content.match(/S:(.*?);/);
        const passMatch = content.match(/P:(.*?);/);
        const authMatch = content.match(/T:(.*?);/);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl text-indigo-700">
              <Wifi className="w-6 h-6" />
              <div className="text-left">
                <p className="text-xs font-bold uppercase opacity-60">Network Name (SSID)</p>
                <p className="font-bold">{ssidMatch ? ssidMatch[1] : 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl text-slate-700">
              <Lock className="w-6 h-6" />
              <div className="text-left">
                <p className="text-xs font-bold uppercase opacity-60">Password</p>
                <p className="font-bold">{passMatch ? passMatch[1] : 'None'}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">Security: {authMatch ? authMatch[1] : 'WPA'}</p>
          </div>
        );
      case 'upi':
        const upiParams = new URLSearchParams(content.split('?')[1]);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl text-emerald-700">
              <CreditCard className="w-6 h-6" />
              <div className="text-left">
                <p className="text-xs font-bold uppercase opacity-60">Payee Name</p>
                <p className="font-bold">{upiParams.get('pn') || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl text-slate-700">
              <Smartphone className="w-6 h-6" />
              <div className="text-left">
                <p className="text-xs font-bold uppercase opacity-60">UPI ID</p>
                <p className="font-bold">{upiParams.get('pa') || 'Unknown'}</p>
              </div>
            </div>
            {upiParams.get('am') && (
              <div className="p-4 bg-indigo-600 rounded-xl text-white text-center">
                <p className="text-xs font-bold uppercase opacity-60">Amount</p>
                <p className="text-2xl font-bold">₹{upiParams.get('am')}</p>
              </div>
            )}
          </div>
        );
      case 'whatsapp':
        const waPhone = content.match(/wa\.me\/(.*?)\?/);
        const waMsg = content.match(/\?text=(.*)/);
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl text-green-700">
              <MessageCircle className="w-6 h-6" />
              <div className="text-left">
                <p className="text-xs font-bold uppercase opacity-60">WhatsApp Number</p>
                <p className="font-bold">+{waPhone ? waPhone[1] : 'Unknown'}</p>
              </div>
            </div>
            {waMsg && (
              <div className="p-4 bg-slate-50 rounded-xl text-slate-700 text-left">
                <p className="text-xs font-bold uppercase opacity-60 mb-1">Message</p>
                <p className="text-sm italic">"{decodeURIComponent(waMsg[1])}"</p>
              </div>
            )}
          </div>
        );
      case 'vcard':
        return (
          <div className="space-y-3 text-left">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold uppercase text-slate-400 mb-2">Contact Details</p>
              <pre className="text-xs font-mono whitespace-pre-wrap">{content}</pre>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 break-all font-mono text-sm text-left">
            {content}
          </div>
        );
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Oops!</h1>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link to="/"><Button>Go to Homepage</Button></Link>
        </div>
      </div>
    );
  }

  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full" />
          <p className="text-slate-600 font-medium">Redirecting to destination...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{qrData?.title || 'QR Code Details'}</h1>
        <p className="text-slate-500 mb-8 capitalize">{qrData?.type} Information</p>
        
        <div className="mb-8">
          {renderContentDetails()}
        </div>

        <div className="space-y-3">
          {qrData?.type === 'url' && (
            <Button 
              className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700"
              onClick={() => window.location.href = qrData.redirectUrl || qrData.content}
            >
              Open Link <ExternalLink className="ml-2 w-5 h-5" />
            </Button>
          )}
          {qrData?.type === 'whatsapp' && (
            <Button 
              className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700"
              onClick={() => window.location.href = qrData.content}
            >
              Send Message <MessageCircle className="ml-2 w-5 h-5" />
            </Button>
          )}
          {qrData?.type === 'upi' && (
            <Button 
              className="w-full h-12 text-lg font-bold bg-emerald-600 hover:bg-emerald-700"
              onClick={() => window.location.href = qrData.content}
            >
              Pay Now <CreditCard className="ml-2 w-5 h-5" />
            </Button>
          )}
          <Button 
            variant="outline" 
            className="w-full h-12 font-bold border-2"
            onClick={() => navigate('/')}
          >
            Create Your Own QR <QrCode className="ml-2 w-5 h-5" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-4">Powered by QR Boraj Quantum</p>
      </Card>
    </div>
  );
};

const SupportPage = () => (
  <div className="max-w-4xl mx-auto py-12 px-4">
    <h1 className="text-4xl font-bold mb-8">Support Center</h1>
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-indigo-600" /> Contact Us
        </h2>
        <p className="text-slate-600 mb-6">Our team is here to help you with any questions or technical issues.</p>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-400" />
            <span>support@qrboraj.com</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-slate-400" />
            <span>+91 123 456 7890</span>
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-600" /> FAQ
        </h2>
        <div className="space-y-4">
          <div>
            <p className="font-bold text-sm">How do dynamic QR codes work?</p>
            <p className="text-xs text-slate-500">Dynamic QR codes use a short redirect URL, allowing you to change the destination even after printing.</p>
          </div>
          <div>
            <p className="font-bold text-sm">Can I track scans?</p>
            <p className="text-xs text-slate-500">Yes, all dynamic QR codes come with advanced analytics including location and device data.</p>
          </div>
        </div>
      </Card>
    </div>
  </div>
);

const APIDocsPage = () => (
  <div className="max-w-4xl mx-auto py-12 px-4">
    <h1 className="text-4xl font-bold mb-8">API Documentation</h1>
    <Card className="p-8">
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">Authentication</h2>
          <p className="text-slate-600 mb-4">All API requests must include your API key in the headers.</p>
          <div className="bg-slate-900 text-slate-100 p-4 rounded-lg font-mono text-sm">
            Authorization: Bearer YOUR_API_KEY
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-bold mb-4">WordPress Integration</h2>
          <p className="text-slate-600 mb-4">To use QR Boraj Quantum with WordPress, you can use our official shortcode or embed the generator via iframe.</p>
          <div className="bg-slate-100 p-4 rounded-lg space-y-4">
            <div>
              <p className="font-bold text-sm mb-1">Option 1: Iframe Embed</p>
              <code className="text-xs bg-white p-2 block border rounded">
                {`<iframe src="https://qrboraj.com/generator?embed=true" width="100%" height="600px" frameborder="0"></iframe>`}
              </code>
            </div>
            <div>
              <p className="font-bold text-sm mb-1">Option 2: PHP Integration (cPanel)</p>
              <p className="text-xs text-slate-500 mb-2">You can call our API directly from your WordPress theme's functions.php file.</p>
              <pre className="text-[10px] bg-slate-900 text-slate-100 p-3 rounded overflow-x-auto">
{`$response = wp_remote_post('https://qrboraj.com/api/v1/generate', [
  'headers' => ['Authorization' => 'Bearer YOUR_API_KEY'],
  'body' => json_encode(['type' => 'url', 'content' => 'https://yoursite.com'])
]);`}
              </pre>
            </div>
          </div>
        </section>
      </div>
    </Card>
  </div>
);

const LegalPage = ({ title, content }: { title: string, content: string }) => (
  <div className="max-w-3xl mx-auto py-12 px-4">
    <h1 className="text-4xl font-bold mb-8">{title}</h1>
    <Card className="p-8 prose prose-slate max-w-none">
      <div className="whitespace-pre-wrap text-slate-600 leading-relaxed">
        {content}
      </div>
    </Card>
  </div>
);

const ApiSettings = ({ user }: { user: UserProfile }) => {
  const [newKeyName, setNewKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [thirdPartyKeys, setThirdPartyKeys] = useState(user.thirdPartyKeys || {});

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    try {
      const newKey: ApiKey = {
        id: Math.random().toString(36).substr(2, 9),
        key: 'qrb_' + Math.random().toString(36).substr(2, 24),
        name: newKeyName,
        createdAt: new Date(),
      };
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        apiKeys: [...(user.apiKeys || []), newKey]
      });
      setNewKeyName('');
      alert('API Key generated successfully!');
    } catch (error) {
      console.error('Error generating key:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        apiKeys: (user.apiKeys || []).filter(k => k.id !== keyId)
      });
    } catch (error) {
      console.error('Error deleting key:', error);
    }
  };

  const saveThirdPartyKeys = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { thirdPartyKeys });
      alert('Third-party keys saved successfully!');
    } catch (error) {
      console.error('Error saving keys:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">API & Integration Settings</h1>
      
      <div className="grid gap-8">
        {/* QR Boraj API Keys */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" /> QR Boraj API Keys
          </h2>
          <p className="text-slate-500 text-sm mb-6">Use these keys to integrate QR Boraj with your own applications, WordPress, or cPanel.</p>
          
          <div className="flex gap-2 mb-8">
            <Input 
              placeholder="Key Name (e.g. My Website)" 
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
            />
            <Button onClick={generateKey} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" /> Generate Key
            </Button>
          </div>

          <div className="space-y-3">
            {user.apiKeys?.map(key => (
              <div key={key.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-bold text-slate-900">{key.name}</p>
                  <p className="text-xs font-mono text-slate-500">{key.key}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteKey(key.id)} className="text-red-600 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {(!user.apiKeys || user.apiKeys.length === 0) && (
              <p className="text-center py-4 text-slate-400 text-sm italic">No API keys generated yet.</p>
            )}
          </div>
        </Card>

        {/* Third-Party Integrations */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-600" /> Payment Gateway Integrations
          </h2>
          <p className="text-slate-500 text-sm mb-6">Insert your own Payment Gateway credentials to receive payments directly.</p>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <img src="https://www.payu.in/favicon.ico" className="w-4 h-4" alt="PayU" /> PayU Settings
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Merchant ID</label>
                  <Input 
                    value={thirdPartyKeys.payu?.merchantId || ''} 
                    onChange={e => setThirdPartyKeys({...thirdPartyKeys, payu: {...(thirdPartyKeys.payu || {}), merchantId: e.target.value} as any})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Merchant Key</label>
                  <Input 
                    value={thirdPartyKeys.payu?.key || ''} 
                    onChange={e => setThirdPartyKeys({...thirdPartyKeys, payu: {...(thirdPartyKeys.payu || {}), key: e.target.value} as any})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Merchant Salt</label>
                  <Input 
                    type="password"
                    value={thirdPartyKeys.payu?.salt || ''} 
                    onChange={e => setThirdPartyKeys({...thirdPartyKeys, payu: {...(thirdPartyKeys.payu || {}), salt: e.target.value} as any})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <img src="https://razorpay.com/favicon.png" className="w-4 h-4" alt="Razorpay" /> Razorpay Settings
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Key ID</label>
                  <Input 
                    value={thirdPartyKeys.razorpay?.keyId || ''} 
                    onChange={e => setThirdPartyKeys({...thirdPartyKeys, razorpay: {...(thirdPartyKeys.razorpay || {}), keyId: e.target.value} as any})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Key Secret</label>
                  <Input 
                    type="password"
                    value={thirdPartyKeys.razorpay?.keySecret || ''} 
                    onChange={e => setThirdPartyKeys({...thirdPartyKeys, razorpay: {...(thirdPartyKeys.razorpay || {}), keySecret: e.target.value} as any})}
                  />
                </div>
              </div>
            </div>

            <Button className="w-full py-3" onClick={saveThirdPartyKeys} disabled={loading}>
              <Database className="w-4 h-4 mr-2" /> Save Integration Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          setUser(snap.data() as UserProfile);
        } else {
          const newUser: UserProfile = { 
            uid: u.uid, email: u.email || '', 
            displayName: u.displayName || 'User', 
            photoURL: u.photoURL || '', 
            role: 'user', 
            subscription: { planId: 'free', status: 'active', startDate: new Date(), endDate: null, trialUsed: false },
            createdAt: new Date() 
          };
          setUser(newUser);
        }
      } else setUser(null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><QrCode className="w-12 h-12 text-indigo-600 animate-pulse" /></div>;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans">
        <Routes>
          <Route path="/s/:qrId" element={<RedirectHandler />} />
          <Route path="*" element={
            <>
              <Navbar user={user} onLogout={() => signOut(auth)} />
              <main>
                <Routes>
                  <Route path="/" element={user ? <Dashboard user={user} /> : <LoginPage />} />
                  <Route path="/login" element={user ? <Dashboard user={user} /> : <LoginPage />} />
                  <Route path="/generator" element={user ? <Generator user={user} /> : <LoginPage />} />
                  <Route path="/analytics" element={user ? <Dashboard user={user} /> : <LoginPage />} />
                  <Route path="/analytics/:qrId" element={user ? <Analytics user={user} /> : <LoginPage />} />
                  <Route path="/subscription" element={user ? <SubscriptionPage user={user} /> : <LoginPage />} />
                  <Route path="/api-settings" element={user ? <ApiSettings user={user} /> : <LoginPage />} />
                  <Route path="/campaigns" element={user ? <Campaigns user={user} /> : <LoginPage />} />
                  <Route path="/support" element={<SupportPage />} />
                  <Route path="/api-docs" element={<APIDocsPage />} />
                  <Route path="/privacy" element={<LegalPage title="Privacy Policy" content="Your privacy is important to us. This policy explains how we collect, use, and protect your personal information when you use QR Boraj Quantum.\n\n1. Data Collection: We collect information you provide directly to us, such as when you create an account or generate a QR code.\n\n2. Usage: We use your data to provide and improve our services, including analytics for your QR codes.\n\n3. Security: We implement industry-standard security measures to protect your data." />} />
                  <Route path="/terms" element={<LegalPage title="Terms of Service" content="By using QR Boraj Quantum, you agree to the following terms:\n\n1. Acceptable Use: You agree not to use our service for any illegal or harmful activities.\n\n2. Intellectual Property: All content and technology on this platform are owned by QR Boraj.\n\n3. Limitation of Liability: We are not responsible for any damages resulting from the use of our QR codes." />} />
                </Routes>
              </main>
              <footer className="bg-white border-t border-slate-200 py-12 mt-20">
                <div className="max-w-7xl mx-auto px-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <QrCode className="w-5 h-5 text-indigo-600" />
                    <span className="font-bold text-slate-900">QR Boraj Quantum</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-6">80+ Smart Points Ecosystem for the next generation of marketing.</p>
                  <div className="flex justify-center gap-8 text-xs font-bold uppercase tracking-widest text-slate-400">
                    <Link to="/privacy" className="hover:text-indigo-600 transition-colors">Privacy</Link>
                    <Link to="/terms" className="hover:text-indigo-600 transition-colors">Terms</Link>
                    <Link to="/api-docs" className="hover:text-indigo-600 transition-colors">API Docs</Link>
                    <Link to="/support" className="hover:text-indigo-600 transition-colors">Support</Link>
                  </div>
                  <p className="mt-8 text-xs text-slate-400">© 2026 QR Boraj Quantum Platform. All rights reserved.</p>
                </div>
              </footer>
            </>
          } />
        </Routes>
      </div>
    </Router>
  );
}
