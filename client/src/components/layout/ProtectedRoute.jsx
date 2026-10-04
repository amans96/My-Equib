
import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Wait until we know whether the user is authenticated
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading...
        </div>
      </div>
    );
  }

  // User is not logged in
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // User is logged in but does not have permission
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    if (user?.role === "ADMIN") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    if (user?.role === "SUPER_ADMIN") {
      return <Navigate to="/super-admin/dashboard" replace />;
    }

    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

