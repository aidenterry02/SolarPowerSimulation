/**
 * US city climate + rate lookup for the hometown solar demo.
 * peakSunHours: approximate annual-average peak sun hours (NREL-style PSH).
 * cloudCoverPct: typical annual average cloud cover.
 * avgTempF: approximate annual mean temperature.
 * ratePerKwh: residential average electricity rate ($/kWh) by state (EIA-ish).
 */
export interface City {
  name: string;
  state: string;
  lat: number;
  lon: number;
  peakSunHours: number;
  cloudCoverPct: number;
  avgTempF: number;
  ratePerKwh: number;
}

export const CITIES: City[] = [
  { name: "Phoenix", state: "AZ", lat: 33.45, lon: -112.07, peakSunHours: 6.5, cloudCoverPct: 20, avgTempF: 75, ratePerKwh: 0.14 },
  { name: "Tucson", state: "AZ", lat: 32.22, lon: -110.97, peakSunHours: 6.4, cloudCoverPct: 22, avgTempF: 71, ratePerKwh: 0.14 },
  { name: "Las Vegas", state: "NV", lat: 36.17, lon: -115.14, peakSunHours: 6.3, cloudCoverPct: 22, avgTempF: 70, ratePerKwh: 0.15 },
  { name: "Albuquerque", state: "NM", lat: 35.08, lon: -106.65, peakSunHours: 6.2, cloudCoverPct: 28, avgTempF: 58, ratePerKwh: 0.14 },
  { name: "Denver", state: "CO", lat: 39.74, lon: -104.99, peakSunHours: 5.5, cloudCoverPct: 40, avgTempF: 51, ratePerKwh: 0.15 },
  { name: "Colorado Springs", state: "CO", lat: 38.83, lon: -104.82, peakSunHours: 5.6, cloudCoverPct: 38, avgTempF: 49, ratePerKwh: 0.15 },
  { name: "Salt Lake City", state: "UT", lat: 40.76, lon: -111.89, peakSunHours: 5.4, cloudCoverPct: 42, avgTempF: 53, ratePerKwh: 0.12 },
  { name: "Boise", state: "ID", lat: 43.62, lon: -116.2, peakSunHours: 5.2, cloudCoverPct: 45, avgTempF: 53, ratePerKwh: 0.11 },
  { name: "Los Angeles", state: "CA", lat: 34.05, lon: -118.24, peakSunHours: 5.6, cloudCoverPct: 35, avgTempF: 66, ratePerKwh: 0.32 },
  { name: "San Diego", state: "CA", lat: 32.72, lon: -117.16, peakSunHours: 5.7, cloudCoverPct: 32, avgTempF: 64, ratePerKwh: 0.32 },
  { name: "San Francisco", state: "CA", lat: 37.77, lon: -122.42, peakSunHours: 5.0, cloudCoverPct: 45, avgTempF: 58, ratePerKwh: 0.32 },
  { name: "San Jose", state: "CA", lat: 37.34, lon: -121.89, peakSunHours: 5.4, cloudCoverPct: 38, avgTempF: 61, ratePerKwh: 0.32 },
  { name: "Sacramento", state: "CA", lat: 38.58, lon: -121.49, peakSunHours: 5.5, cloudCoverPct: 36, avgTempF: 62, ratePerKwh: 0.32 },
  { name: "Fresno", state: "CA", lat: 36.74, lon: -119.79, peakSunHours: 5.8, cloudCoverPct: 30, avgTempF: 65, ratePerKwh: 0.32 },
  { name: "Portland", state: "OR", lat: 45.52, lon: -122.68, peakSunHours: 3.9, cloudCoverPct: 62, avgTempF: 54, ratePerKwh: 0.12 },
  { name: "Seattle", state: "WA", lat: 47.61, lon: -122.33, peakSunHours: 3.7, cloudCoverPct: 68, avgTempF: 53, ratePerKwh: 0.12 },
  { name: "Spokane", state: "WA", lat: 47.66, lon: -117.43, peakSunHours: 4.2, cloudCoverPct: 55, avgTempF: 49, ratePerKwh: 0.12 },
  { name: "Honolulu", state: "HI", lat: 21.31, lon: -157.86, peakSunHours: 5.5, cloudCoverPct: 45, avgTempF: 77, ratePerKwh: 0.42 },
  { name: "Anchorage", state: "AK", lat: 61.22, lon: -149.9, peakSunHours: 2.8, cloudCoverPct: 65, avgTempF: 37, ratePerKwh: 0.24 },
  { name: "Dallas", state: "TX", lat: 32.78, lon: -96.8, peakSunHours: 5.2, cloudCoverPct: 42, avgTempF: 67, ratePerKwh: 0.15 },
  { name: "Houston", state: "TX", lat: 29.76, lon: -95.37, peakSunHours: 4.8, cloudCoverPct: 50, avgTempF: 70, ratePerKwh: 0.15 },
  { name: "Austin", state: "TX", lat: 30.27, lon: -97.74, peakSunHours: 5.1, cloudCoverPct: 44, avgTempF: 69, ratePerKwh: 0.15 },
  { name: "San Antonio", state: "TX", lat: 29.42, lon: -98.49, peakSunHours: 5.2, cloudCoverPct: 42, avgTempF: 70, ratePerKwh: 0.15 },
  { name: "El Paso", state: "TX", lat: 31.76, lon: -106.49, peakSunHours: 6.1, cloudCoverPct: 28, avgTempF: 65, ratePerKwh: 0.15 },
  { name: "Fort Worth", state: "TX", lat: 32.76, lon: -97.33, peakSunHours: 5.2, cloudCoverPct: 42, avgTempF: 66, ratePerKwh: 0.15 },
  { name: "Oklahoma City", state: "OK", lat: 35.47, lon: -97.52, peakSunHours: 5.1, cloudCoverPct: 44, avgTempF: 61, ratePerKwh: 0.12 },
  { name: "Tulsa", state: "OK", lat: 36.15, lon: -95.99, peakSunHours: 5.0, cloudCoverPct: 46, avgTempF: 61, ratePerKwh: 0.12 },
  { name: "Kansas City", state: "MO", lat: 39.1, lon: -94.58, peakSunHours: 4.7, cloudCoverPct: 48, avgTempF: 56, ratePerKwh: 0.13 },
  { name: "St. Louis", state: "MO", lat: 38.63, lon: -90.2, peakSunHours: 4.6, cloudCoverPct: 50, avgTempF: 57, ratePerKwh: 0.13 },
  { name: "Omaha", state: "NE", lat: 41.26, lon: -95.94, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 52, ratePerKwh: 0.12 },
  { name: "Wichita", state: "KS", lat: 37.69, lon: -97.34, peakSunHours: 5.0, cloudCoverPct: 44, avgTempF: 57, ratePerKwh: 0.14 },
  { name: "Little Rock", state: "AR", lat: 34.75, lon: -92.29, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 63, ratePerKwh: 0.12 },
  { name: "New Orleans", state: "LA", lat: 29.95, lon: -90.07, peakSunHours: 4.7, cloudCoverPct: 50, avgTempF: 70, ratePerKwh: 0.12 },
  { name: "Baton Rouge", state: "LA", lat: 30.45, lon: -91.19, peakSunHours: 4.7, cloudCoverPct: 50, avgTempF: 69, ratePerKwh: 0.12 },
  { name: "Jackson", state: "MS", lat: 32.3, lon: -90.18, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 66, ratePerKwh: 0.13 },
  { name: "Memphis", state: "TN", lat: 35.15, lon: -90.05, peakSunHours: 4.7, cloudCoverPct: 48, avgTempF: 63, ratePerKwh: 0.13 },
  { name: "Nashville", state: "TN", lat: 36.16, lon: -86.78, peakSunHours: 4.6, cloudCoverPct: 50, avgTempF: 60, ratePerKwh: 0.13 },
  { name: "Knoxville", state: "TN", lat: 35.96, lon: -83.92, peakSunHours: 4.5, cloudCoverPct: 52, avgTempF: 59, ratePerKwh: 0.13 },
  { name: "Louisville", state: "KY", lat: 38.25, lon: -85.76, peakSunHours: 4.4, cloudCoverPct: 52, avgTempF: 58, ratePerKwh: 0.13 },
  { name: "Lexington", state: "KY", lat: 38.04, lon: -84.5, peakSunHours: 4.4, cloudCoverPct: 52, avgTempF: 57, ratePerKwh: 0.13 },
  { name: "Atlanta", state: "GA", lat: 33.75, lon: -84.39, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 63, ratePerKwh: 0.14 },
  { name: "Savannah", state: "GA", lat: 32.08, lon: -81.09, peakSunHours: 4.9, cloudCoverPct: 46, avgTempF: 67, ratePerKwh: 0.14 },
  { name: "Birmingham", state: "AL", lat: 33.52, lon: -86.81, peakSunHours: 4.7, cloudCoverPct: 50, avgTempF: 64, ratePerKwh: 0.15 },
  { name: "Mobile", state: "AL", lat: 30.69, lon: -88.04, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 68, ratePerKwh: 0.15 },
  { name: "Jacksonville", state: "FL", lat: 30.33, lon: -81.66, peakSunHours: 5.0, cloudCoverPct: 45, avgTempF: 69, ratePerKwh: 0.15 },
  { name: "Miami", state: "FL", lat: 25.76, lon: -80.19, peakSunHours: 5.2, cloudCoverPct: 42, avgTempF: 78, ratePerKwh: 0.15 },
  { name: "Orlando", state: "FL", lat: 28.54, lon: -81.38, peakSunHours: 5.1, cloudCoverPct: 44, avgTempF: 73, ratePerKwh: 0.15 },
  { name: "Tampa", state: "FL", lat: 27.95, lon: -82.46, peakSunHours: 5.2, cloudCoverPct: 42, avgTempF: 74, ratePerKwh: 0.15 },
  { name: "Tallahassee", state: "FL", lat: 30.44, lon: -84.28, peakSunHours: 4.9, cloudCoverPct: 46, avgTempF: 68, ratePerKwh: 0.15 },
  { name: "Charleston", state: "SC", lat: 32.78, lon: -79.93, peakSunHours: 4.9, cloudCoverPct: 46, avgTempF: 66, ratePerKwh: 0.14 },
  { name: "Columbia", state: "SC", lat: 34.0, lon: -81.03, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 64, ratePerKwh: 0.14 },
  { name: "Charlotte", state: "NC", lat: 35.23, lon: -80.84, peakSunHours: 4.7, cloudCoverPct: 48, avgTempF: 61, ratePerKwh: 0.13 },
  { name: "Raleigh", state: "NC", lat: 35.78, lon: -78.64, peakSunHours: 4.7, cloudCoverPct: 48, avgTempF: 60, ratePerKwh: 0.13 },
  { name: "Asheville", state: "NC", lat: 35.6, lon: -82.55, peakSunHours: 4.4, cloudCoverPct: 52, avgTempF: 56, ratePerKwh: 0.13 },
  { name: "Richmond", state: "VA", lat: 37.54, lon: -77.44, peakSunHours: 4.5, cloudCoverPct: 50, avgTempF: 59, ratePerKwh: 0.14 },
  { name: "Virginia Beach", state: "VA", lat: 36.85, lon: -75.98, peakSunHours: 4.6, cloudCoverPct: 48, avgTempF: 60, ratePerKwh: 0.14 },
  { name: "Norfolk", state: "VA", lat: 36.85, lon: -76.29, peakSunHours: 4.6, cloudCoverPct: 48, avgTempF: 60, ratePerKwh: 0.14 },
  { name: "Washington", state: "DC", lat: 38.91, lon: -77.04, peakSunHours: 4.4, cloudCoverPct: 52, avgTempF: 58, ratePerKwh: 0.16 },
  { name: "Baltimore", state: "MD", lat: 39.29, lon: -76.61, peakSunHours: 4.4, cloudCoverPct: 52, avgTempF: 57, ratePerKwh: 0.16 },
  { name: "Philadelphia", state: "PA", lat: 39.95, lon: -75.17, peakSunHours: 4.2, cloudCoverPct: 54, avgTempF: 56, ratePerKwh: 0.16 },
  { name: "Pittsburgh", state: "PA", lat: 40.44, lon: -79.99, peakSunHours: 4.0, cloudCoverPct: 58, avgTempF: 52, ratePerKwh: 0.16 },
  { name: "New York", state: "NY", lat: 40.71, lon: -74.01, peakSunHours: 4.1, cloudCoverPct: 55, avgTempF: 55, ratePerKwh: 0.24 },
  { name: "Buffalo", state: "NY", lat: 42.89, lon: -78.88, peakSunHours: 3.8, cloudCoverPct: 62, avgTempF: 48, ratePerKwh: 0.24 },
  { name: "Rochester", state: "NY", lat: 43.16, lon: -77.61, peakSunHours: 3.8, cloudCoverPct: 62, avgTempF: 48, ratePerKwh: 0.24 },
  { name: "Albany", state: "NY", lat: 42.65, lon: -73.76, peakSunHours: 3.9, cloudCoverPct: 60, avgTempF: 49, ratePerKwh: 0.24 },
  { name: "Boston", state: "MA", lat: 42.36, lon: -71.06, peakSunHours: 4.0, cloudCoverPct: 56, avgTempF: 52, ratePerKwh: 0.28 },
  { name: "Worcester", state: "MA", lat: 42.26, lon: -71.8, peakSunHours: 4.0, cloudCoverPct: 56, avgTempF: 50, ratePerKwh: 0.28 },
  { name: "Providence", state: "RI", lat: 41.82, lon: -71.41, peakSunHours: 4.0, cloudCoverPct: 56, avgTempF: 52, ratePerKwh: 0.26 },
  { name: "Hartford", state: "CT", lat: 41.76, lon: -72.69, peakSunHours: 4.0, cloudCoverPct: 56, avgTempF: 51, ratePerKwh: 0.28 },
  { name: "New Haven", state: "CT", lat: 41.31, lon: -72.92, peakSunHours: 4.0, cloudCoverPct: 56, avgTempF: 52, ratePerKwh: 0.28 },
  { name: "Portland", state: "ME", lat: 43.66, lon: -70.26, peakSunHours: 3.9, cloudCoverPct: 58, avgTempF: 47, ratePerKwh: 0.26 },
  { name: "Manchester", state: "NH", lat: 42.99, lon: -71.45, peakSunHours: 3.9, cloudCoverPct: 58, avgTempF: 48, ratePerKwh: 0.24 },
  { name: "Burlington", state: "VT", lat: 44.48, lon: -73.21, peakSunHours: 3.7, cloudCoverPct: 62, avgTempF: 45, ratePerKwh: 0.22 },
  { name: "Newark", state: "NJ", lat: 40.74, lon: -74.17, peakSunHours: 4.1, cloudCoverPct: 55, avgTempF: 55, ratePerKwh: 0.19 },
  { name: "Jersey City", state: "NJ", lat: 40.73, lon: -74.07, peakSunHours: 4.1, cloudCoverPct: 55, avgTempF: 55, ratePerKwh: 0.19 },
  { name: "Chicago", state: "IL", lat: 41.88, lon: -87.63, peakSunHours: 4.2, cloudCoverPct: 54, avgTempF: 51, ratePerKwh: 0.15 },
  { name: "Springfield", state: "IL", lat: 39.78, lon: -89.65, peakSunHours: 4.4, cloudCoverPct: 52, avgTempF: 53, ratePerKwh: 0.15 },
  { name: "Indianapolis", state: "IN", lat: 39.77, lon: -86.16, peakSunHours: 4.3, cloudCoverPct: 54, avgTempF: 53, ratePerKwh: 0.15 },
  { name: "Fort Wayne", state: "IN", lat: 41.08, lon: -85.14, peakSunHours: 4.2, cloudCoverPct: 55, avgTempF: 51, ratePerKwh: 0.15 },
  { name: "Columbus", state: "OH", lat: 39.96, lon: -83.0, peakSunHours: 4.2, cloudCoverPct: 55, avgTempF: 53, ratePerKwh: 0.14 },
  { name: "Cleveland", state: "OH", lat: 41.5, lon: -81.69, peakSunHours: 3.9, cloudCoverPct: 60, avgTempF: 51, ratePerKwh: 0.14 },
  { name: "Cincinnati", state: "OH", lat: 39.1, lon: -84.51, peakSunHours: 4.2, cloudCoverPct: 55, avgTempF: 55, ratePerKwh: 0.14 },
  { name: "Toledo", state: "OH", lat: 41.65, lon: -83.54, peakSunHours: 4.0, cloudCoverPct: 58, avgTempF: 51, ratePerKwh: 0.14 },
  { name: "Detroit", state: "MI", lat: 42.33, lon: -83.05, peakSunHours: 4.0, cloudCoverPct: 58, avgTempF: 50, ratePerKwh: 0.19 },
  { name: "Grand Rapids", state: "MI", lat: 42.96, lon: -85.67, peakSunHours: 4.0, cloudCoverPct: 58, avgTempF: 49, ratePerKwh: 0.19 },
  { name: "Milwaukee", state: "WI", lat: 43.04, lon: -87.91, peakSunHours: 4.1, cloudCoverPct: 56, avgTempF: 48, ratePerKwh: 0.16 },
  { name: "Madison", state: "WI", lat: 43.07, lon: -89.4, peakSunHours: 4.1, cloudCoverPct: 56, avgTempF: 47, ratePerKwh: 0.16 },
  { name: "Minneapolis", state: "MN", lat: 44.98, lon: -93.27, peakSunHours: 4.2, cloudCoverPct: 55, avgTempF: 46, ratePerKwh: 0.15 },
  { name: "St. Paul", state: "MN", lat: 44.95, lon: -93.09, peakSunHours: 4.2, cloudCoverPct: 55, avgTempF: 46, ratePerKwh: 0.15 },
  { name: "Des Moines", state: "IA", lat: 41.59, lon: -93.62, peakSunHours: 4.5, cloudCoverPct: 50, avgTempF: 51, ratePerKwh: 0.13 },
  { name: "Fargo", state: "ND", lat: 46.88, lon: -96.79, peakSunHours: 4.3, cloudCoverPct: 52, avgTempF: 42, ratePerKwh: 0.12 },
  { name: "Sioux Falls", state: "SD", lat: 43.55, lon: -96.73, peakSunHours: 4.5, cloudCoverPct: 50, avgTempF: 47, ratePerKwh: 0.13 },
  { name: "Billings", state: "MT", lat: 45.78, lon: -108.5, peakSunHours: 4.8, cloudCoverPct: 48, avgTempF: 48, ratePerKwh: 0.12 },
  { name: "Cheyenne", state: "WY", lat: 41.14, lon: -104.82, peakSunHours: 5.2, cloudCoverPct: 42, avgTempF: 46, ratePerKwh: 0.12 },
  { name: "Reno", state: "NV", lat: 39.53, lon: -119.81, peakSunHours: 5.6, cloudCoverPct: 35, avgTempF: 53, ratePerKwh: 0.15 },
];

export function cityLabel(c: City): string {
  return `${c.name}, ${c.state}`;
}

export function searchCities(query: string, limit = 12): City[] {
  const q = query.trim().toLowerCase();
  if (!q) return CITIES.slice(0, limit);
  const scored = CITIES.map((c) => {
    const label = cityLabel(c).toLowerCase();
    let score = 0;
    if (label.startsWith(q)) score = 100;
    else if (c.name.toLowerCase().startsWith(q)) score = 90;
    else if (c.state.toLowerCase() === q) score = 80;
    else if (label.includes(q)) score = 50;
    else if (c.name.toLowerCase().includes(q)) score = 40;
    return { c, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((x) => x.c);
}
