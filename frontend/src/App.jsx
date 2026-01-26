import React, { useState } from "react";
import Login from "./login";
import Register from "./register";
import Dashboard from "./dashboard";

export default function App() {
  const [page, setPage] = useState("login"); // login | register | dashboard
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null
  );

  function handleLogin(t, u) {
    setToken(t);
    setUser(u);
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
    setPage("dashboard");
  }

  function logout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setPage("login");
  }

  if (!token || !user) {
    if (page === "register") {
      return <Register onGoLogin={() => setPage("login")} />;
    }
    return <Login onLogin={handleLogin} onGoRegister={() => setPage("register")} />;
  }

  return <Dashboard token={token} user={user} onLogout={logout} />;
}
