import { NavLink } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const Sidebar = () => {
const { user } = useAuth();
const role = user?.role;

const memberLinks = [
{
label: "Dashboard",
path: "/dashboard",
icon: "⌂",
},
{
label: "My Equbs",
path: "/equbs",
icon: "◎",
},
{
label: "Profile",
path: "/profile",
icon: "◯",
},
];

const adminLinks = [
{
label: "Dashboard",
path: "/admin/dashboard",
icon: "⌂",
},
{
label: "My Equbs",
path: "/admin/equbs",
icon: "◎",
},
{
label: "Create Equb",
path: "/admin/equbs/create",
icon: "+",
},
];

const superAdminLinks = [
{
label: "Dashboard",
path: "/super-admin/dashboard",
icon: "⌂",
},
{
label: "Users",
path: "/super-admin/users",
icon: "◯",
},
{
label: "Equbs",
path: "/super-admin/equbs",
icon: "◎",
},
{
label: "Transactions",
path: "/super-admin/transactions",
icon: "◆",
},
];

const links =
role === "ADMIN"
? adminLinks
: role === "SUPER_ADMIN"
? superAdminLinks
: memberLinks;

const roleLabel =
role === "ADMIN"
? "Administration"
: role === "SUPER_ADMIN"
? "Super Admin"
: "Member";

return ( <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-200 bg-white lg:flex lg:flex-col">
{/* Brand */} <div className="flex h-20 items-center border-b border-gray-200 px-6"> <div> <h1 className="text-2xl font-bold tracking-tight text-gray-900">
Equb </h1>

```
      <p className="mt-1 text-xs text-gray-500">
        {roleLabel}
      </p>
    </div>
  </div>

  {/* Navigation */}
  <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
    {links.map((link) => (
      <NavLink
        key={link.path}
        to={link.path}
        className={({ isActive }) =>
          [
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
            isActive
              ? "bg-gray-900 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base",
                isActive
                  ? "bg-white/10"
                  : "bg-gray-100",
              ].join(" ")}
            >
              {link.icon}
            </span>

            <span>{link.label}</span>
          </>
        )}
      </NavLink>
    ))}
  </nav>

  {/* User */}
  <div className="border-t border-gray-200 p-4">
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <p className="truncate text-sm font-semibold text-gray-900">
        {user?.fullName || "User"}
      </p>

      <p className="mt-1 truncate text-xs text-gray-500">
        {user?.phone || user?.email || "Authenticated user"}
      </p>
    </div>
  </div>
</aside>


);
};

export default Sidebar;
