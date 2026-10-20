export type Locality = {
  area?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
};

export const localityLabel = (place: Locality) => place.area ?? place.city ?? place.region ?? place.country ?? "";

export const localityKey = (place: Locality & { id: string }) => place.area ?? place.city ?? place.countryCode ?? place.country ?? place.id;
