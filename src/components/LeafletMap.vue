<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import { INDEX_LEVEL, type IndexLabel, type Spot } from '../lib/marine-data'

const props = withDefaults(
  defineProps<{
    spots: Spot[]
    height?: number
    focusId?: string
    highlightId?: string
    navigateOnClick?: boolean
  }>(),
  {
    height: 380,
    focusId: undefined,
    highlightId: undefined,
    navigateOnClick: true,
  },
)

const emit = defineEmits<{
  navigate: [id: string]
}>()

const container = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let markerLayer: L.LayerGroup | null = null

onMounted(async () => {
  await nextTick()
  createMap()
  renderMarkers()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

watch(
  () => [props.spots, props.focusId, props.highlightId] as const,
  () => {
    renderMarkers()
  },
  { deep: true },
)

function createMap() {
  if (!container.value || map) return

  const center = focusedCenter() ?? [36.2, 127.8]
  map = L.map(container.value, {
    center,
    zoom: props.focusId ? 11 : 7,
    scrollWheelZoom: false,
    zoomControl: true,
  })

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map)

  markerLayer = L.layerGroup().addTo(map)
}

function renderMarkers() {
  if (!map) return
  markerLayer?.clearLayers()
  if (!props.spots.length) return

  const bounds: L.LatLngExpression[] = []
  for (const spot of props.spots) {
    const isFocus = spot.id === props.focusId
    const isHighlight = spot.id === props.highlightId
    const size = isFocus ? 18 : 14
    const color = toneColor(spot.totalIndex)
    const icon = L.divIcon({
      className: 'marine-div-icon',
      html: `<div class="marine-marker${isHighlight ? ' highlighted' : ''}" style="--marker-color:${color};width:${size}px;height:${size}px;"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })

    const marker = L.marker([spot.lat, spot.lot], { icon }).addTo(markerLayer!)
    marker.bindTooltip(
      `<div class="marine-tooltip">
        <div class="marine-tooltip-title">${escapeHtml(spot.name)}</div>
        <div class="marine-tooltip-meta">${escapeHtml(spot.region)} · ${escapeHtml(spot.totalIndex)}</div>
      </div>`,
      { direction: 'top', offset: [0, -8] },
    )

    if (props.navigateOnClick) marker.on('click', () => emit('navigate', spot.id))
    bounds.push([spot.lat, spot.lot])
  }

  if (props.focusId) {
    const center = focusedCenter()
    if (center) map.setView(center, 11)
  } else if (bounds.length > 1) {
    map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40] })
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 11)
  }

  map.invalidateSize()
}

function focusedCenter(): [number, number] | null {
  const spot = props.focusId ? props.spots.find((item) => item.id === props.focusId) : null
  return spot ? [spot.lat, spot.lot] : null
}

function toneColor(label: IndexLabel) {
  const level = INDEX_LEVEL[label]
  if (level >= 4) return '#3b82f6'
  if (level === 3) return '#f59e0b'
  return '#ef4444'
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
</script>

<template>
  <div ref="container" class="leaflet-map" :style="{ height: `${height}px` }"></div>
</template>
