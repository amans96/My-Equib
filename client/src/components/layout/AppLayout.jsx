import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNav from "./MobileNav";

const AppLayout = () => {
return ( <div className="min-h-screen bg-gray-50 text-gray-900"> <Sidebar />

  <div className="min-h-screen lg:pl-64">
    <Header />

    <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
      <Outlet />
    </main>
  </div>

  <MobileNav />
</div>

);
};

export default AppLayout;
