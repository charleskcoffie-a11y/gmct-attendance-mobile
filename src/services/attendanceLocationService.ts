import { supabase } from '../supabase';

interface AttendanceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface AttendanceLocationCheck {
  isWithinArea: boolean;
  message?: string;
}

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_ATTENDANCE_RADIUS_METERS = 150;

const toRadians = (degrees: number) => degrees * (Math.PI / 180);
const toConfiguredNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function getAttendanceErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}

export async function checkAttendanceLocation({
  latitude,
  longitude,
  accuracy,
}: AttendanceLocation): Promise<AttendanceLocationCheck> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('church_latitude, church_longitude, attendance_radius_meters')
    .eq('id', 'app_settings')
    .single();

  if (error) {
    console.error('Error checking attendance location:', error);
    throw error;
  }

  const churchLatitude = toConfiguredNumber(data?.church_latitude);
  const churchLongitude = toConfiguredNumber(data?.church_longitude);
  const configuredRadius = toConfiguredNumber(data?.attendance_radius_meters);
  const attendanceRadius = configuredRadius ?? DEFAULT_ATTENDANCE_RADIUS_METERS;

  if (churchLatitude === null || churchLongitude === null) {
    throw new Error('Church attendance location is not configured.');
  }

  if (accuracy > attendanceRadius) {
    return {
      isWithinArea: false,
      message: 'Location accuracy is too low. Please try again outside or near a window.',
    };
  }

  const latitudeDifference = toRadians(latitude - churchLatitude);
  const longitudeDifference = toRadians(longitude - churchLongitude);
  const latitude1 = toRadians(churchLatitude);
  const latitude2 = toRadians(latitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDifference / 2) ** 2;
  const distanceMeters =
    EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));

  if (distanceMeters > attendanceRadius) {
    return {
      isWithinArea: false,
      message: 'You are outside the church attendance area.',
    };
  }

  return { isWithinArea: true };
}
