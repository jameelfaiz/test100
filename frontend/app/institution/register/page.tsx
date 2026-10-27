"use client";
import React, { useState, useEffect } from "react";
import { Inter } from "next/font/google";
import { useRouter } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

const apiBase = "/api";

async function fetchCsrfToken() {
  const res = await fetch(`${apiBase}/auth/csrf-token`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`CSRF token request failed with status ${res.status}`);
  const data = await res.json();
  return data.csrfToken;
}

type Step = "credentials" | "details" | "done";

export default function InstitutionRegister() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [step, setStep] = useState<Step>("credentials");
  const [message, setMessage] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collegeId, setCollegeId] = useState<string>("");

  // Step 1 fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 fields (all optional - completed later via complete-profile)
  const [instName, setInstName] = useState("");
  const [instType, setInstType] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [authorizedContact, setAuthorizedContact] = useState("");

  useEffect(() => {
    fetchCsrfToken().then(setCsrfToken).catch(console.error);
  }, []);

  const post = async (path: string, body: any) => {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": csrfToken,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  };

  const handleCredentialSubmit = () => {
    setIsError(false);
    setMessage("");
    if (!username.trim() || username.trim().length < 3) {
      setIsError(true);
      setMessage("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      setIsError(true);
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("Passwords do not match.");
      return;
    }
    setStep("details");
  };

  const handleRegister = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsError(false);
    setMessage("");
    try {
      const { ok, data } = await post("/institution/register", {
        username: username.trim(),
        name: instName.trim() || username.trim(),
        institutionType: instType.trim() || "Technical",
        email: email.trim() || `${username.trim()}@institution.aicte.ac.in`,
        contactNumber: contactNumber.trim() || "0000000000",
        state: stateVal.trim() || "India",
        district: district.trim() || "Unknown",
        address: address.trim() || "Address not provided",
        principalName: principalName.trim() || "Not provided",
        authorizedContactPerson: authorizedContact.trim() || "Not provided",
        password,
        confirmPassword,
      });
      if (!ok) {
        setIsError(true);
        setMessage(data.message || "Registration failed. Please try again.");
        if (data.message?.toLowerCase().includes("username")) {
          setStep("credentials");
        }
      } else {
        setCollegeId(data.collegeId);
        setStep("done");
        setMessage(data.message || "Account created successfully. You can now access your institution portal.");
      }
    } catch (e: any) {
      setIsError(true);
      setMessage(e.message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMessage = () =>
    message ? (
      <div className={`p-3 rounded font-medium text-sm border ${isError ? "bg-rose-50 border-rose-300 text-rose-900" : "bg-emerald-50 border-emerald-300 text-emerald-900"}`}>
        {message}
      </div>
    ) : null;

  if (step === "done") {
    return (
      <main className={`${inter.className} min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4`}>
        <div className="bg-white border border-slate-300 shadow-2xl rounded-xl p-8 w-full max-w-lg text-center">
          <div className="text-5xl mb-4">&#9989;</div>
          <h1 className="text-2xl font-extrabold text-blue-950 tracking-tight mb-2">Registration Successful</h1>
          <p className="text-slate-600 text-sm mb-1">Account created successfully. You can now access your institution portal.</p>
          {collegeId && (
            <p className="text-slate-500 text-xs mb-4">
              Your College ID: <span className="font-mono font-semibold text-slate-700">{collegeId}</span>
            </p>
          )}
          <p className="text-slate-500 text-xs mb-6">
            Log in with your username <strong>{username}</strong> and the password you set.
          </p>
          <button onClick={() => router.push("/")} className="btn-primary w-full">
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  if (step === "details") {
    return (
      <main className={`${inter.className} min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4`}>
        <div className="bg-white border border-slate-300 shadow-2xl rounded-xl p-8 w-full max-w-lg">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-blue-950 tracking-tight">Institution Details</h1>
            <p className="text-sm font-medium text-slate-600 mt-1">Enter your institution information (all optional — can be completed after login)</p>
          </div>
          {renderMessage()}
          <div className="flex flex-col gap-3 w-full mt-4 text-slate-800">
            <input placeholder="Institution Name" value={instName} onChange={(e) => setInstName(e.target.value)} className="input" />
            <input placeholder="Institution Type (e.g. Technical, Pharmacy)" value={instType} onChange={(e) => setInstType(e.target.value)} className="input" />
            <input placeholder="Official Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            <input placeholder="Contact Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="input" />
            <input placeholder="State" value={stateVal} onChange={(e) => setStateVal(e.target.value)} className="input" />
            <input placeholder="District / City" value={district} onChange={(e) => setDistrict(e.target.value)} className="input" />
            <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
            <input placeholder="Principal Name" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} className="input" />
            <input placeholder="Authorized Contact Person" value={authorizedContact} onChange={(e) => setAuthorizedContact(e.target.value)} className="input" />
            <p className="text-xs text-slate-400 -mt-1">All fields above are optional. You can complete your profile after logging in.</p>
            <button onClick={handleRegister} disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Creating Account..." : "Create Institution Account"}
            </button>
            <button onClick={() => { setStep("credentials"); setMessage(""); setIsError(false); }} className="text-sm text-blue-700 hover:underline text-center">
              Back to Credentials
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${inter.className} min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4`}>
      <div className="bg-white border border-slate-300 shadow-2xl rounded-xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-blue-950 tracking-tight">New Institution Sign Up</h1>
          <p className="text-sm font-medium text-slate-600 mt-1">Choose a username and password — no email verification required</p>
        </div>
        {renderMessage()}
        <div className="flex flex-col gap-4 w-full text-slate-800 mt-4">
          <div>
            <input placeholder="Preferred Username (e.g. svce2024)" name="username" value={username} onChange={(e) => setUsername(e.target.value)} className="input w-full" autoFocus />
            <p className="text-xs text-slate-400 mt-1">This will be your login ID. Must be unique. Min 3 characters.</p>
          </div>
          <input placeholder="Password (min. 6 characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          <input placeholder="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" onKeyDown={(e) => e.key === "Enter" && handleCredentialSubmit()} />
          <button onClick={handleCredentialSubmit} className="btn-primary">Continue &rarr;</button>
          <div className="text-center mt-2">
            <a href="/" className="text-blue-700 hover:underline text-sm">Already registered? Login here</a>
          </div>
        </div>
      </div>
    </main>
  );
}
