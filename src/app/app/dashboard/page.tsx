"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserStats {
  tryOnCount: number;
  planName: string;
  planLimit: number;
}

export default function DashboardPage() {
  const { currentUser, isLoadingAuth } = useAuth();
  const router = useRouter();

  // Debug logging
  console.log("Dashboard - currentUser:", currentUser);
  console.log("Dashboard - isLoadingAuth:", isLoadingAuth);
  console.log("Dashboard - email:", currentUser?.email);
  const [stats, setStats] = useState<UserStats>({
    tryOnCount: 0,
    planName: "Free",
    planLimit: 5,
  });

  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, isLoadingAuth, router]);

  useEffect(() => {
    // TODO: Fetch user profile from Firestore
    // For now, use default values
    const planName = "Free"; // TODO: Get from Firestore userProfile
    const planLimit = 5;

    setStats({
      tryOnCount: 0, // TODO: Get from usage tracking
      planName,
      planLimit,
    });
  }, [currentUser]);

  if (isLoadingAuth) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </main>
    );
  }

  if (!currentUser) {
    return null;
  }

  const remainingTryOns = stats.planLimit - stats.tryOnCount;
  const usagePercentage = (stats.tryOnCount / stats.planLimit) * 100;

  return (
    <main className="flex min-h-screen flex-col space-y-10 p-4 lg:p-10">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Welcome back,{" "}
            {currentUser.displayName ||
              currentUser.email?.split("@")[0] ||
              "User"}
            ! 👋
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your VTON account today.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Plan Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm text-gray-500">Current Plan</h2>
              <p className="text-3xl font-bold">{stats.planName}</p>
              <div className="card-actions justify-end mt-2">
                <button className="btn btn-primary btn-sm">
                  {stats.planName === "Free" ? "Upgrade" : "Manage"}
                </button>
              </div>
            </div>
          </div>

          {/* Usage Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm text-gray-500">Try-Ons Used</h2>
              <p className="text-3xl font-bold">
                {stats.tryOnCount} /{" "}
                {stats.planLimit === 999999 ? "∞" : stats.planLimit}
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div
                  className="bg-primary h-2.5 rounded-full"
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Remaining Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm text-gray-500">Remaining</h2>
              <p className="text-3xl font-bold">
                {stats.planLimit === 999999 ? "Unlimited" : remainingTryOns}
              </p>
              {remainingTryOns <= 2 && stats.planLimit !== 999999 && (
                <div className="badge badge-warning mt-2">Running low!</div>
              )}
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="card bg-base-100 shadow-xl mb-8">
          <div className="card-body">
            <h2 className="card-title mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-semibold">{currentUser.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Display Name</p>
                <p className="font-semibold">
                  {currentUser.displayName || "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Account Created</p>
                <p className="font-semibold">
                  {currentUser.metadata.creationTime
                    ? new Date(
                        currentUser.metadata.creationTime,
                      ).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Subscription Status</p>
                <div className="badge badge-success">Active</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => router.push("/vton")}
                className="btn btn-primary btn-lg"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                New Try-On
              </button>
              <button className="btn btn-outline btn-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                History
              </button>
              <button className="btn btn-outline btn-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
              <button className="btn btn-outline btn-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Help
              </button>
            </div>
          </div>
        </div>

        {/* Low Usage Warning */}
        {remainingTryOns <= 2 && stats.planLimit !== 999999 && (
          <div className="alert alert-warning shadow-lg mt-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current flex-shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-bold">You're running low on try-ons!</h3>
              <div className="text-xs">
                You have {remainingTryOns} try-on
                {remainingTryOns !== 1 ? "s" : ""} remaining. Consider upgrading
                to continue using VTON.
              </div>
            </div>
            <button className="btn btn-sm">Upgrade Now</button>
          </div>
        )}
      </div>
    </main>
  );
}
