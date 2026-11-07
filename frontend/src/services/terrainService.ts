const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export interface TerrainResponse {
  location: {
    latitude: number;
    longitude: number;
  };
  elevation_m: number;
  slope_degrees: number;
  terrain_class: string;
  difficulty: string;
  traversability_cost: number;
  interpretation: string;
  model_note: string;
}

export async function getTerrainAtLocation(
  latitude: number,
  longitude: number
): Promise<TerrainResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/terrain?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();

    throw new Error(
      error.detail || "Unable to retrieve terrain information."
    );
  }

  return response.json();
}
