import { Dumbbell, Home, Swords, TrendingUp } from "lucide-react";
import type { NavItem } from "@/types";

export const ROUTES = {
  home: "/",
  train: "/train",
  complete: "/complete",
  career: "/career",
  profile: "/profile",
} as const;

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", path: ROUTES.home, icon: Home },
  { id: "train", label: "Train", path: ROUTES.train, icon: Dumbbell },
  { id: "complete", label: "Tournament", path: ROUTES.complete, icon: Swords },
  { id: "career", label: "Career", path: ROUTES.career, icon: TrendingUp },
];
