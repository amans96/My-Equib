import { NavLink } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const MobileNav = () => {
const { user } = useAuth();
const role = user?.role;

const memberLinks = [
{
label: "Home",
path: "/dashboard",
icon: "⌂",
},
{
label: "Equbs",
path: "/equbs",
icon: "◎",
},
];

const adminLinks = [
{
label: "Home",
path: "/admin/dashboard",
icon: "⌂",
},
{
label: "Equbs",
path: "/admin/equbs",
icon: "◎",
},
{
label: "Create",
path: "/admin/equbs/create",
icon: "+",
},
];

const superAdminLinks = [
{
label: "Home",
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
];

const links =
role === "ADMIN"
? adminLinks
: role === "SUPER_ADMIN"
? superAdminLinks
: memberLinks;

return ( <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"> <div className="mx-auto flex max-w-lg items-center justify-around">
{links.map((link) => (
<NavLink
key={link.path}
to={link.path}
className={({ isActive }) =>
[
"flex min-w-20 flex-col items-center gap-1 px-3 py-3 text-xs font-medium transition-colors",
isActive
? "text-gray-900"
: "text-gray-400 hover:text-gray-700",
].join(" ")
}
>
{({ isActive }) => (
<>
<span
className={[
"flex h-8 w-8 items-center justify-center rounded-xl text-lg",
isActive ? "bg-gray-900 text-white" : "bg-gray-100",
].join(" ")}
>
{link.icon} </span>

```
            <span>{link.label}</span>
          </>
        )}
      </NavLink>
    ))}
  </div>
</nav>


);
};

export default MobileNav;
