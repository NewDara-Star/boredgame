import { Art } from "@/shared/brand/Art";

/** The nav set: coloured and outlined, because icons are objects too (BRAND.md). */
export const IconHome = ({ size = 26 }: { size?: number }) => <Art name="nav-home" style={{ width: size }} />;
export const IconPlay = ({ size = 26 }: { size?: number }) => <Art name="nav-games" style={{ width: size }} />;
export const IconRooms = ({ size = 26 }: { size?: number }) => <Art name="nav-rooms" style={{ width: size }} />;
export const IconRanks = ({ size = 26 }: { size?: number }) => <Art name="nav-ranks" style={{ width: size }} />;
