import { useState, useEffect } from "react";
import {
  getSession, onAuthStateChange, fetchProfile, signOut
} from "./supabase.js";
import LawnPage from "./LawnPage.jsx";

export default function App() {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (u) => {
    try {
      const prof = await fetchProfile(u.id);
      setUser(u);
      setProfile(prof);
    } catch (e) {
      console.warn("App loadUserData:", e.message);
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSession().then(u => {
      if (u) loadUserData(u);
      else setLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange(u => {
      if (u) loadUserData(u);
      else { setUser(null); setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setProfile(null);
  };

  if (loading) return (
    <div style={{
      minHeight: "100vh", background: "#f5f0e6",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .boot-spinner {
          width: 32px; height: 32px;
          border: 2px solid #c8bea8;
          border-top-color: #4a6741;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
      `}</style>
      <div className="boot-spinner" />
      <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#7a6e5e" }}>
        Loading HoneyDew…
      </div>
    </div>
  );

  return (
    <LawnPage
      user={user}
      profile={profile}
      onSignOut={handleSignOut}
      onProfileUpdate={setProfile}
    />
  );
}