/**
 * Tipos compartidos para OmniDrive
 * Define las estructuras de datos que vienen de la API
 */

// Respuesta estandar de la API
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface User {
  id: string;
  authId?: string;
  email: string;
  phone?: string | null;
  name: string;
  lastName: string;
  documentType?: string;
  documentId?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  avatarUrl?: string | null;
  identityVerified: boolean;
  selfieUrl?: string | null;
  documentFrontUrl?: string | null;
  documentBackUrl?: string | null;
  verificationNotes?: string | null;
  verifiedAt?: string | null;
  walletBalance: number;
  subscriptionTier: string;
  subscriptionEnds?: string | null;
  driverScore: number;
  totalTrips: number;
  totalKm: number;
  role: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  owner?: OwnerSummary;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  vin: string;
  category: string;
  seats: number;
  doors?: number | null;
  transmission: string;
  fuelType: string;
  photos: string[];
  pricePerHour: number;
  pricePerDay: number;
  pricePerKm?: number | null;
  deposit: number;
  available: boolean;
  locationLat?: number | null;
  locationLng?: number | null;
  locationName?: string | null;
  withDriver: boolean;
  driverPrice?: number | null;
  flexibleCheckin: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  insurance: boolean;
  features: string[];
  rating: number;
  totalRentals: number;
  occupiedDates?: { startAt: string; endAt: string }[];
  _count?: { reviews: number };
}

export interface OwnerSummary {
  id: string;
  name: string;
  lastName: string;
  phone?: string;
  driverScore: number;
  totalTrips: number;
  identityVerified?: boolean;
  createdAt?: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  vehicle?: VehicleSummary;
  tenantId: string;
  tenant?: UserSummary;
  renterId?: string | null;
  startAt: string;
  endAt: string;
  returnedAt?: string | null;
  withDriver: boolean;
  baseAmount: number;
  driverFee: number;
  serviceFee: number;
  totalAmount: number;
  deposit: number;
  status: string;
  paymentStatus: string;
  trackingEnabled: boolean;
  review?: Review | null;
  photosBefore: string[];
  photosAfter: string[];
}

export interface VehicleSummary {
  id: string;
  brand: string;
  model: string;
  year: number;
  photos: string[];
  plate?: string;
  locationName?: string | null;
  owner?: OwnerSummary;
}

export interface UserSummary {
  id: string;
  name: string;
  lastName: string;
  phone?: string;
  driverScore?: number;
}

export interface Review {
  id: string;
  bookingId: string;
  authorId: string;
  author?: UserSummary;
  targetId: string;
  vehicleId?: string | null;
  rating: number;
  comment?: string | null;
  categories?: any;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: any;
  read: boolean;
  createdAt: string;
}

export interface CountryCode {
  code: string;
  prefix: string;
  name: string;
  flag: string;
}
