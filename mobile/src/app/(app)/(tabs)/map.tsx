import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import { usePlaces } from "@/api/queries";
import { HOME_REGION } from "@/lib/geo";
import { colors, size } from "@/theme";

/** The map: every place as a brass pin (the full design, with your stamped places lit, is built on top of this). */
export default function MapTab() {
  const places = usePlaces();
  return (
    <View style={styles.root}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={HOME_REGION} userInterfaceStyle="dark" showsPointsOfInterests={false} showsCompass={false} pitchEnabled={false}>
        {(places.data?.places ?? []).map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.name} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pin} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pin: { width: size.vibeDot, height: size.vibeDot, borderRadius: size.vibeDot / 2, backgroundColor: colors.brass },
});
