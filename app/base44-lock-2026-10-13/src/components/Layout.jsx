import React, { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { Lock, Unlock, Coins, Flame, Menu, X } from "lucide-react";
import WalletButton from "@/components/WalletButton";

const NAV = [
  { to: "/", label: "Lock", icon: Lock, end: true },
  { to: "/release", label: "Release", icon: Unlock },
  { to: "/issuance", label: "Issuance", icon: Coins },
  { to: "/forge", label: "Forge", icon: Flame },
];

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary/15 text-primary border border-primary/30"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </NavLink>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground bg-grid">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-card/40 backdrop-blur-sm">
        <div className="px-6 py-7">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">VINCULUM</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Protocol</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>
        <div className="px-3 pb-6">
          <p className="px-3 text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-2">
            Base Mainnet
          </p>
          <WalletButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Lock className="h-4 w-4" />
          </div>
          <span className="font-display text-sm font-semibold tracking-tight">VINCULUM</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="max-w-[160px]"><WalletButton /></div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-b border-border bg-card/95 backdrop-blur-md px-4 py-3 space-y-1">
          {NAV.map((item) => (
            <NavItem key={item.to} item={item} onNavigate={() => setOpen(false)} />
          ))}
        </div>
      )}

      {/* Main */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-10 py-8 lg:py-12 pb-24 md:pb-12">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-border bg-card/90 backdrop-blur-md">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}