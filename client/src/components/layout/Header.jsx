import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const Header = () => {
const { user, logout } = useAuth();
const navigate = useNavigate();
const [open, setOpen] = useState(false);

const handleLogout = () => {
logout();
navigate("/login", { replace: true });
};

const displayName = user?.fullName || user?.phone || user?.email || "User";

return ( <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur"> <div className="flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
{/* Mobile brand */} <div className="lg:hidden"> <h1 className="text-xl font-bold tracking-tight text-gray-900">
Equb </h1> </div>

```
    {/* Desktop page area */}
    <div className="hidden lg:block">
      <p className="text-sm text-gray-500">
        Welcome back,
      </p>

      <p className="text-lg font-semibold text-gray-900">
        {displayName}
      </p>
    </div>

    {/* User menu */}
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-gray-100"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
          {displayName.charAt(0).toUpperCase()}
        </div>

        <div className="hidden text-left sm:block">
          <p className="max-w-40 truncate text-sm font-semibold text-gray-900">
            {displayName}
          </p>

          <p className="text-xs text-gray-500">
            {user?.role || "MEMBER"}
          </p>
        </div>

        <span className="hidden text-gray-400 sm:block">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 h-full w-full cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
            <div className="border-b border-gray-100 px-3 py-3">
              <p className="truncate text-sm font-semibold text-gray-900">
                {displayName}
              </p>

              <p className="mt-1 truncate text-xs text-gray-500">
                {user?.phone || user?.email || "Authenticated user"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              className="mt-2 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  </div>
</header>

);
};

export default Header;
