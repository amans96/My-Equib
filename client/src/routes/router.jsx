import { createBrowserRouter, Navigate } from "react-router-dom";

import ProtectedRoute from "../components/layout/ProtectedRoute";
import AppLayout from "../components/layout/AppLayout";
import LotteryPage from "../pages/admin/LotteryPage";
// =========================================================
// AUTH PAGES
// =========================================================

import LoginPage from "../pages/auth/LoginPage";

// =========================================================
// ADMIN PAGES
// =========================================================

import AdminDashboard from "../pages/admin/AdminDashboard";
import CreateEqubPage from "../pages/admin/CreateEqubPage";
import EqubsPage from "../pages/admin/EqubsPage";
import EqubDetailsPage from "../pages/admin/EqubDetailsPage";
import MembersPage from "../pages/admin/MembersPage";
import PaymentPeriodsPage from "../pages/admin/PaymentPeriodsPage";
import PaymentPeriodDetailsPage from "../pages/admin/PaymentPeriodDetailsPage";
import OCRDetailsPage from "../pages/admin/OCRDetailsPage";

// =========================================================
// TEMPORARY PAGES
// =========================================================

const Register = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-gray-900">
      Register
    </h1>
  </div>
);

const MemberDashboard = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-gray-900">
      Member Dashboard
    </h1>
  </div>
);

const SuperAdminDashboard = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-gray-900">
      Super Admin Dashboard
    </h1>
  </div>
);

const Placeholder = ({ title }) => (
  <div className="p-6">
    <h1 className="text-2xl font-bold text-gray-900">
      {title}
    </h1>
  </div>
);

// =========================================================
// ROLE REDIRECT
// =========================================================

function RoleRedirect() {
  const storedUser = localStorage.getItem("user");

  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(storedUser);

    if (user?.role === "ADMIN") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    if (user?.role === "SUPER_ADMIN") {
      return <Navigate to="/super-admin/dashboard" replace />;
    }

    if (user?.role === "MEMBER") {
      return <Navigate to="/dashboard" replace />;
    }

    localStorage.removeItem("user");
    localStorage.removeItem("token");

    return <Navigate to="/login" replace />;
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    return <Navigate to="/login" replace />;
  }
}

// =========================================================
// ROUTER
// =========================================================

const router = createBrowserRouter([
  // =========================================================
  // AUTH ROUTES
  // =========================================================

  {
    path: "/login",
    element: <LoginPage />,
  },

  {
    path: "/register",
    element: <Register />,
  },

  // =========================================================
  // MEMBER ROUTES
  // =========================================================

  {
    element: <ProtectedRoute allowedRoles={["MEMBER"]} />,

    children: [
      {
        element: <AppLayout />,

        children: [
          {
            path: "/dashboard",
            element: <MemberDashboard />,
          },

          {
            path: "/equbs",
            element: <Placeholder title="My Equbs" />,
          },

          {
            path: "/equbs/:equbId",
            element: <Placeholder title="Equb Details" />,
          },

          {
            path: "/equbs/:equbId/periods",
            element: <Placeholder title="Payment Periods" />,
          },

          {
            path: "/profile",
            element: <Placeholder title="Profile" />,
          },
        ],
      },
    ],
  },

  // =========================================================
  // ADMIN ROUTES
  // =========================================================

  {
    element: <ProtectedRoute allowedRoles={["ADMIN"]} />,

    children: [
      {
        element: <AppLayout />,

        children: [
          // Admin dashboard
          {
            path: "/admin/dashboard",
            element: <AdminDashboard />,
          },

          // Equbs
          {
            path: "/admin/equbs",
            element: <EqubsPage />,
          },

          // Create Equb
          {
            path: "/admin/equbs/create",
            element: <CreateEqubPage />,
          },

          // Equb details
          {
            path: "/admin/equbs/:equbId",
            element: <EqubDetailsPage />,
          },

          // Equb members
          {
            path: "/admin/equbs/:equbId/members",
            element: <MembersPage />,
          },

          // Payment periods
          {
            path: "/admin/equbs/:equbId/periods",
            element: <PaymentPeriodsPage />,
          },

          // =================================================
          // PAYMENT PERIOD DETAILS
          // =================================================

          {
            path: "/admin/equbs/:equbId/periods/:periodId",
            element: <PaymentPeriodDetailsPage />,
          },

          // =================================================
          // OCR DETAILS
          // =================================================

          {
            path: "/admin/equbs/:equbId/periods/:periodId/receipts/:receiptId/ocr",
            element: <OCRDetailsPage />,
          },

          // =================================================
          // OTHER ADMIN PAGES
          // =================================================

          {
            path: "/admin/equbs/:equbId/payments",
            element: <Placeholder title="Payments" />,
          },

          {
            path: "/admin/equbs/:equbId/receipts",
            element: <Placeholder title="Receipts" />,
          },

        {
  path: "/admin/equbs/:equbId/lottery",
  element: <LotteryPage />,
},
        ],
      },
    ],
  },

  // =========================================================
  // SUPER ADMIN ROUTES
  // =========================================================

  {
    element: <ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />,

    children: [
      {
        element: <AppLayout />,

        children: [
          {
            path: "/super-admin/dashboard",
            element: <SuperAdminDashboard />,
          },

          {
            path: "/super-admin/users",
            element: <Placeholder title="Users" />,
          },

          {
            path: "/super-admin/equbs",
            element: <Placeholder title="Equbs" />,
          },

          {
            path: "/super-admin/transactions",
            element: <Placeholder title="Transactions" />,
          },
        ],
      },
    ],
  },

  // =========================================================
  // ROOT ROUTE
  // =========================================================

  {
    path: "/",
    element: <RoleRedirect />,
  },

  // =========================================================
  // 404
  // =========================================================

  {
    path: "*",

    element: (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            404
          </h1>

          <p className="mt-2 text-gray-500">
            Page not found.
          </p>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go Back
          </button>
        </div>
      </div>
    ),
  },
]);

export default router;