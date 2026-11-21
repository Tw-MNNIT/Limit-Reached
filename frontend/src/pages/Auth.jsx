import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";

      const payload = isLogin
        ? { email, password }
        : { name, email, password };

      const response = await api.post(endpoint, payload);

      localStorage.setItem("joi_token", response.data.token);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>JOI<span>.</span></h1>
        <p>Your intelligent personal assistant.</p>

        <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          {error && <p className="error">{error}</p>}

          <button disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Login" : "Register"}
          </button>
        </form>

        <p className="switch">
          {isLogin ? "New to JOI?" : "Already have an account?"}
          <span onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? " Create account" : " Login"}
          </span>
        </p>
      </div>
    </div>
  );
}