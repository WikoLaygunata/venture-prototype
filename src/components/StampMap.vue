<script setup>
/**
 * StampMap — interactive Leaflet map of Location Stamps.
 * Updated: CARTO Voyager tiles, sleek custom markers with active pulse,
 * smooth popups, and clean modern controls.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { getColorCode } from '@/lib/colorCodes'
import { CAMPUS_CENTER } from '@/lib/mockData'

const props = defineProps({
  stamps: { type: Array, default: () => [] },
  userCoords: { type: Object, default: null },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['open'])

const el = ref(null)
let map = null
let stampLayer = null
let userMarker = null

const points = computed(() => props.stamps.filter((s) => s.lat != null && s.lng != null))

/* --------------------------------------------------------------- icon html */

const CODE_HEX = {
  mint: '#10b981',
  yellow: '#f59e0b',
  grey: '#64748b',
  red: '#f43f5e',
}



function stampIcon(stamp) {
  const color = CODE_HEX[getColorCode(stamp.profile?.color_code).key] ?? CODE_HEX.mint
  const locked = (stamp.audience ?? 'public') === 'mutual'
  const avatarUrl = stamp.profile?.avatar_url

  // Jika ada foto profil, pakai avatar. Jika tidak ada, pakai ikon status
  const innerContent = avatarUrl
    ? `<img src="${avatarUrl}" class="h-full w-full rounded-full object-cover" alt="avatar" />`
    : `<span class="text-[13px] leading-none">${locked ? '🔒' : '📍'}</span>`

  return L.divIcon({
    className: 'kenalan-pin-wrapper',
    html: `
      <div class="stamp-pin-container group">
        <!-- Ambient Pulse Halo -->
        <span class="stamp-pin-halo" style="background-color: ${color};"></span>
        
        <!-- Main Pin Teardrop Body -->
        <div class="stamp-pin-bubble" style="border-color: ${color};">
          ${innerContent}
        </div>

        <!-- Small Badge Indicator (Atas Kanan) -->
        ${avatarUrl ? `<span class="stamp-pin-badge">${locked ? '🔒' : '📍'}</span>` : ''}

        <!-- Pointer Tail -->
        <div class="stamp-pin-tail" style="background-color: ${color};"></div>
      </div>`,
    iconSize: [42, 48],
    iconAnchor: [21, 48],
    popupAnchor: [0, -48],
  })
}

const userIcon = L.divIcon({
  className: 'kenalan-user-pin-wrapper',
  html: `
    <div class="user-pulse-outer">
      <span class="user-pulse-ring"></span>
      <span class="user-pulse-core"></span>
    </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

/* ------------------------------------------------------------------ markers */

function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

function renderStamps() {
  if (!map || !stampLayer) return
  stampLayer.clearLayers()

  for (const stamp of points.value) {
    const name = escapeHtml(stamp.profile?.full_name ?? 'Anonim')
    const msg = escapeHtml(stamp.message ?? '')
    const marker = L.marker([stamp.lat, stamp.lng], { icon: stampIcon(stamp) })

    if (props.readonly) {
      marker.bindPopup(
        `<div class="stamp-popup-card">
           <strong class="stamp-popup-title">${name}</strong>
           <p class="stamp-popup-msg">${msg}</p>
         </div>`,
      )
    } else {
      marker.bindPopup(
        `<div class="stamp-popup-card">
           <strong class="stamp-popup-title">${name}</strong>
           <p class="stamp-popup-msg">${msg}</p>
           <button data-open="${stamp.id}" class="stamp-popup-btn">
             Buka thread
           </button>
         </div>`,
      )
    }
    marker.on('click', () => marker.openPopup())
    stampLayer.addLayer(marker)
  }
}

function renderUser() {
  if (!map) return
  if (userMarker) {
    map.removeLayer(userMarker)
    userMarker = null
  }
  if (props.userCoords?.lat != null) {
    userMarker = L.marker([props.userCoords.lat, props.userCoords.lng], {
      icon: userIcon,
      zIndexOffset: 1000,
      interactive: false,
    }).addTo(map)
  }
}

function fitView() {
  if (!map) return
  const pts = points.value.map((s) => [s.lat, s.lng])
  if (props.userCoords?.lat != null) pts.push([props.userCoords.lat, props.userCoords.lng])

  if (pts.length > 1) {
    map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 })
  } else if (pts.length === 1) {
    map.setView(pts[0], 16)
  } else {
    map.setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], 15)
  }
}

function refresh() {
  if (!map) return
  map.invalidateSize()
  fitView()
}
defineExpose({ refresh })

/* --------------------------------------------------------------- lifecycle */

onMounted(() => {
  map = L.map(el.value, {
    zoomControl: false, // Disembunyikan agar UI mobile lebih clean
    scrollWheelZoom: true,
    attributionControl: true,
  })

  map.attributionControl.setPrefix(false)

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri',
  }).addTo(map)

  stampLayer = L.layerGroup().addTo(map)

  if (!props.readonly) {
    map.on('popupopen', (e) => {
      const btn = e.popup.getElement()?.querySelector('[data-open]')
      if (!btn) return
      btn.addEventListener(
        'click',
        () => {
          const id = btn.getAttribute('data-open')
          const stamp = props.stamps.find((s) => s.id === id)
          if (stamp) emit('open', stamp)
        },
        { once: true },
      )
    })
  }

  renderStamps()
  renderUser()
  fitView()

  setTimeout(() => map && map.invalidateSize(), 180)
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.stamps,
  () => {
    renderStamps()
    fitView()
  },
  { deep: true },
)

watch(
  () => props.userCoords,
  () => {
    renderUser()
  },
  { deep: true },
)
</script>

<template>
  <div ref="el" class="kenalan-map h-full w-full" role="application" aria-label="Peta stamp lokasi" />
</template>

<style>
/* ----------------------------------------------------------------------------
   TILE & MAP STYLING
--------------------------------------------------------------------------- */
.leaflet-container {
  font-family: inherit;
  background: #f8fafc;
}

/* 2. Soft cartography filter agar warna pin kustom kamu menonjol */
.kenalan-map .leaflet-tile-pane {
  filter: saturate(0.85) contrast(0.95) brightness(1.02);
}

/* ----------------------------------------------------------------------------
   CUSTOM MARKERS (STAMP & USER)
--------------------------------------------------------------------------- */
/* Pin Stamp Bulat & Glowing Ring */
.stamp-pin-outer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
}

.stamp-pin-pulse {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  opacity: 0.25;
  transform: scale(0.85);
  transition: transform 0.2s ease;
}

.stamp-pin-body {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9999px;
  border: 2.5px solid #ffffff;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.22);
  transition: transform 0.15s ease-out;
}

.stamp-pin-outer:active .stamp-pin-body {
  transform: scale(0.9);
}

.stamp-pin-icon {
  font-size: 13px;
  line-height: 1;
}

/* User Radar Pulse Effect */
.user-pulse-outer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.user-pulse-ring {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background-color: #38bdf8;
  animation: kenalanPulse 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.user-pulse-core {
  position: relative;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background-color: #0284c7;
  border: 2.5px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

@keyframes kenalanPulse {
  0% { transform: scale(0.5); opacity: 0.8; }
  70%, 100% { transform: scale(1.8); opacity: 0; }
}

/* ----------------------------------------------------------------------------
   POPUP STYLING
--------------------------------------------------------------------------- */
.leaflet-popup-content-wrapper {
  border-radius: 18px !important;
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1) !important;
  padding: 2px !important;
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(8px);
}

.leaflet-popup-content {
  margin: 12px 14px !important;
}

.leaflet-popup-tip {
  background: rgba(255, 255, 255, 0.98) !important;
}

.stamp-popup-card {
  min-width: 140px;
}

.stamp-popup-title {
  display: block;
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}

.stamp-popup-msg {
  margin: 3px 0 10px;
  font-size: 12px;
  line-height: 1.4;
  color: #475569;
}

.stamp-popup-btn {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: #7c56f7;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.stamp-popup-btn:active {
  transform: scale(0.97);
  background: #6b46e5;
}

/* ----------------------------------------------------------------------------
   LEAFLET CONTROLS & Z-INDEX
--------------------------------------------------------------------------- */
.kenalan-map.leaflet-container {
  z-index: 0;
}
.kenalan-map .leaflet-pane,
.kenalan-map .leaflet-top,
.kenalan-map .leaflet-bottom {
  z-index: 1 !important;
}
.kenalan-map .leaflet-popup {
  z-index: 2 !important;
}

.kenalan-map .leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.7);
  color: #94a3b8;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 6px 0 0 0;
  backdrop-filter: blur(4px);
}

.kenalan-map .leaflet-control-attribution a {
  color: #64748b;
  text-decoration: none;
}

/* zz */
/* Container Utama Marker */
.stamp-pin-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 42px;
  height: 48px;
  cursor: pointer;
}

/* Ambient Pulse / Glow Effect di Belakang Pin */
.stamp-pin-halo {
  position: absolute;
  top: 4px;
  width: 34px;
  height: 34px;
  border-radius: 9999px;
  opacity: 0.35;
  filter: blur(4px);
  animation: pinPulse 2.5s infinite ease-in-out;
}

/* Lingkaran Bodi Pin (Tempat Avatar / Ikon) */
.stamp-pin-bubble {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  background-color: #ffffff;
  border: 3px solid; /* Warna border dinamis sesuai color code */
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
  overflow: hidden;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stamp-pin-container:hover .stamp-pin-bubble {
  transform: translateY(-3px) scale(1.08);
}

/* Badge Kecil Status (Gembok / Pin) di Sudut Pin */
.stamp-pin-badge {
  position: absolute;
  top: -2px;
  right: -1px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background-color: #ffffff;
  font-size: 9px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  border: 1px solid #e2e8f0;
}

/* Ekor Marker Menunjuk ke Koordinat Presisi */
.stamp-pin-tail {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  margin-top: -6px;
  transform: rotate(45deg);
  border-bottom-right-radius: 2px;
  box-shadow: 2px 2px 4px rgba(15, 23, 42, 0.15);
}

@keyframes pinPulse {
  0%, 100% {
    transform: scale(0.85);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.25);
    opacity: 0.15;
  }
}

</style>