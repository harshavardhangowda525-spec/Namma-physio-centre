import {
  Activity, Armchair, Bone, Brain, Dumbbell, Footprints, HandHeart, HeartPulse, Home, Link2,
  Scale, Scissors, Stethoscope, Trophy, Waves, PersonStanding, type LucideIcon,
} from "lucide-react";
import type { ServiceIcon } from "@/content/services";

export const serviceIcons: Record<ServiceIcon, LucideIcon> = {
  stethoscope: Stethoscope,
  activity: Activity,
  bone: Bone,
  scissors: Scissors,
  footprints: Footprints,
  link: Link2,
  spine: PersonStanding,
  hand: HandHeart,
  brain: Brain,
  heart: HeartPulse,
  home: Home,
  scale: Scale,
  armchair: Armchair,
  dumbbell: Dumbbell,
  waves: Waves,
  trophy: Trophy,
};
