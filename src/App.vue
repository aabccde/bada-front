<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  EXPERIENCE_DESC,
  EXPERIENCE_LABELS,
  INDEX_LEVEL,
  SPOTS_BY_EXPERIENCE,
  getSpot,
  getSpots,
  indexTone,
  type ExperienceKey,
  type IndexLabel,
  type Spot,
} from './lib/marine-data'
import { defaultDate, getDateOptions } from './lib/date-utils'
import {
  SORT_LABELS,
  filterByQuery,
  haversine,
  sortSpots,
  type SortKey,
} from './lib/spot-utils'
import LeafletMap from './components/LeafletMap.vue'

type Page = 'home' | 'all' | 'spot' | 'auth' | 'me' | 'settings'
type CommunityPost = {
  id: string
  spotId: string
  title: string
  content: string
  imageUrl: string | null
  createdAt: string
  author: string
  authorEmail?: string
  comments: CommunityComment[]
}
type CommunityComment = {
  id: string
  content: string
  createdAt: string
  author: string
}

const VALID_EXP: ExperienceKey[] = ['travel', 'surfing', 'fishing', 'scuba', 'mudflat', 'swimming']
const VALID_SORT: SortKey[] = ['index', 'community', 'distance']

const page = ref<Page>('home')
const spotId = ref('')
const allExp = ref<ExperienceKey>('travel')
const allSort = ref<SortKey>('index')
const allQuery = ref('')
const allRegion = ref<string | undefined>()

const homeExperience = ref<ExperienceKey>('travel')
const homeSort = ref<SortKey>('index')
const selectedDate = ref(defaultDate())
const listDate = ref(defaultDate())
const geo = reactive<{ loc: { lat: number; lon: number } | null; loading: boolean; error: string | null }>({
  loc: null,
  loading: false,
  error: null,
})
const user = reactive({
  loggedIn: false,
  name: 'Marine User',
  email: 'demo@marinepro.kr',
  avatarUrl: '',
  createdAt: '',
})
const community = ref<CommunityPost[]>([])
const postForm = reactive({ title: '', content: '', imageUrl: '' })
const commentDrafts = reactive<Record<string, string>>({})
const openPostId = ref<string | null>(null)
const headerQuery = ref('')
const profileMenuOpen = ref(false)
const authMode = ref<'signin' | 'signup'>('signin')
const authForm = reactive({ email: '', password: '', displayName: '' })
const authMessage = ref('')
const settingsForm = reactive({
  displayName: '',
  newPassword: '',
  confirmPassword: '',
  deleteText: '',
})

const dateOptions = computed(() => getDateOptions())
const counts = computed<Record<string, number>>(() => {
  const acc: Record<string, number> = {}
  for (const post of community.value) acc[post.spotId] = (acc[post.spotId] ?? 0) + 1
  return acc
})

const homeSpots = computed(() => getSpots(homeExperience.value))
const homeSorted = computed(() => sortSpots(homeSpots.value, homeSort.value, { counts: counts.value, userLoc: geo.loc }))
const homePreview = computed(() => homeSorted.value.slice(0, 6))
const homeDateLabel = computed(() => dateOptions.value.find((o) => o.value === selectedDate.value)?.label ?? selectedDate.value)

const allSpots = computed(() => SPOTS_BY_EXPERIENCE[allExp.value])
const regions = computed(() => {
  const map = new Map<string, number>()
  for (const spot of allSpots.value) {
    const root = regionRoot(spot.region)
    map.set(root, (map.get(root) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
})
const filteredAll = computed(() => {
  let spots = filterByQuery(allSpots.value, allQuery.value)
  if (allRegion.value) spots = spots.filter((spot) => regionRoot(spot.region) === allRegion.value)
  return spots
})
const sortedAll = computed(() => sortSpots(filteredAll.value, allSort.value, { counts: counts.value, userLoc: geo.loc }))
const allStats = computed(() => ({
  total: filteredAll.value.length,
  great: filteredAll.value.filter((spot) => INDEX_LEVEL[spot.totalIndex] >= 4).length,
  totalPosts: filteredAll.value.reduce((sum, spot) => sum + (counts.value[spot.id] ?? 0), 0),
}))
const topSpot = computed(() => sortedAll.value[0])
const listDateLabel = computed(() => dateOptions.value.find((o) => o.value === listDate.value)?.label ?? listDate.value)
const currentSpot = computed(() => getSpot(spotId.value))
const spotPosts = computed(() => community.value.filter((post) => post.spotId === spotId.value))
const myPosts = computed(() =>
  community.value.filter((post) => post.authorEmail === user.email || (!post.authorEmail && post.author === user.name)),
)

onMounted(() => {
  loadUser()
  loadCommunity()
  applyRoute()
  window.addEventListener('popstate', applyRoute)
})

watch([page, spotId, allExp, allSort, allQuery, allRegion], () => {
  document.title = titleForPage()
})

function applyRoute() {
  const url = new URL(window.location.href)
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'all') {
    page.value = 'all'
    allExp.value = parseExp(url.searchParams.get('exp'))
    allSort.value = parseSort(url.searchParams.get('sort'))
    allQuery.value = url.searchParams.get('q') ?? ''
    allRegion.value = url.searchParams.get('region') ?? undefined
  } else if (parts[0] === 'spot' && parts[1]) {
    page.value = 'spot'
    spotId.value = parts[1]
  } else if (parts[0] === 'auth') {
    page.value = 'auth'
  } else if (parts[0] === 'me') {
    page.value = 'me'
  } else if (parts[0] === 'settings') {
    page.value = 'settings'
  } else {
    page.value = 'home'
  }
}

function navigate(path: string) {
  profileMenuOpen.value = false
  history.pushState(null, '', path)
  applyRoute()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function goAll(exp = homeExperience.value, sort = homeSort.value) {
  navigate(`/all?exp=${exp}&sort=${sort}`)
}

function updateAllUrl() {
  const params = new URLSearchParams()
  params.set('exp', allExp.value)
  params.set('sort', allSort.value)
  if (allQuery.value.trim()) params.set('q', allQuery.value.trim())
  if (allRegion.value) params.set('region', allRegion.value)
  history.replaceState(null, '', `/all?${params.toString()}`)
}

function parseExp(value: string | null): ExperienceKey {
  return VALID_EXP.includes(value as ExperienceKey) ? (value as ExperienceKey) : 'travel'
}

function parseSort(value: string | null): SortKey {
  return VALID_SORT.includes(value as SortKey) ? (value as SortKey) : 'index'
}

function setAllExp(exp: ExperienceKey) {
  allExp.value = exp
  allRegion.value = undefined
  updateAllUrl()
}

function setAllSort(sort: SortKey) {
  if (sort === 'distance' && !geo.loc) requestLocation()
  allSort.value = sort
  updateAllUrl()
}

function setAllRegion(region?: string) {
  allRegion.value = region
  updateAllUrl()
}

function onAllQueryInput() {
  updateAllUrl()
}

function setHomeSort(sort: SortKey) {
  if (sort === 'distance' && !geo.loc) requestLocation()
  homeSort.value = sort
}

function requestLocation() {
  if (!navigator.geolocation) {
    geo.error = '위치 기능을 지원하지 않는 브라우저입니다.'
    return
  }
  geo.loading = true
  geo.error = null
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geo.loc = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      geo.loading = false
    },
    () => {
      geo.error = '위치 권한이 거부되었습니다.'
      geo.loading = false
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

function regionRoot(region: string) {
  return region.split(/[\s·]+/)[0] ?? region
}

function summary(spot: Spot) {
  switch (spot.experience) {
    case 'travel':
      return { primary: `${spot.avgWtem}° · 파고 ${spot.avgWvhgt}m`, secondary: `${spot.weather} · ${spot.tdlvHrCn}` }
    case 'swimming':
      return { primary: `${spot.avgWtem}° · 파고 ${spot.maxWvhgt}m`, secondary: spot.opnStat }
    case 'fishing':
      return { primary: `${spot.minWtem}-${spot.maxWtem}° · 파고 ${spot.maxWvhgt}m`, secondary: `${spot.seafsTgfshNm} · ${spot.tdlvHrCn}` }
    case 'scuba':
      return { primary: `${spot.minWtem}-${spot.maxWtem}° · 유속 ${spot.maxCrsp}kn`, secondary: `물때 ${spot.tdlvHrCn}` }
    case 'mudflat':
      return { primary: `${spot.minArtmp}-${spot.maxArtmp}° · ${spot.weather}`, secondary: `${spot.mdftExprnBgngTm}~${spot.mdftExprnEndTm}` }
    case 'surfing':
      return { primary: `파고 ${spot.avgWvhgt}m · 주기 ${spot.avgWvpd}s`, secondary: `등급 ${spot.grdCn}` }
  }
}

function highlight(spot: Spot) {
  switch (spot.experience) {
    case 'travel':
      return { label: '물때 / 날씨', value: `${spot.tdlvHrCn} · ${spot.weather}` }
    case 'swimming':
      return { label: '개장 여부', value: spot.opnStat }
    case 'fishing':
      return { label: '대상어 · 물때', value: `${spot.seafsTgfshNm} · ${spot.tdlvHrCn}` }
    case 'scuba':
      return { label: '물때', value: spot.tdlvHrCn }
    case 'mudflat':
      return { label: '체험 시간', value: `${spot.mdftExprnBgngTm} ~ ${spot.mdftExprnEndTm}` }
    case 'surfing':
      return { label: '권장 등급', value: spot.grdCn }
  }
}

function statsForCard(spot: Spot) {
  switch (spot.experience) {
    case 'travel':
      return [
        ['기온', `${spot.avgArtmp}°C`],
        ['수온', `${spot.avgWtem}°C`],
        ['파고', `${spot.avgWvhgt}m`],
        ['풍속', `${spot.avgWspd}m/s`],
      ]
    case 'swimming':
      return [
        ['기온', `${spot.avgArtmp}°C`],
        ['수온', `${spot.avgWtem}°C`],
        ['최고파고', `${spot.maxWvhgt}m`],
        ['최고풍속', `${spot.maxWspd}m/s`],
      ]
    case 'fishing':
      return [
        ['기온', `${spot.minArtmp}-${spot.maxArtmp}°`],
        ['수온', `${spot.minWtem}-${spot.maxWtem}°`],
        ['파고', `${spot.maxWvhgt}m`],
        ['유속', spot.maxCrsp != null ? `${spot.maxCrsp}kn` : '-'],
      ]
    case 'scuba':
      return [
        ['수온', `${spot.minWtem}-${spot.maxWtem}°`],
        ['파고', `${spot.maxWvhgt}m`],
        ['유속', `${spot.maxCrsp}kn`],
        ['물때', spot.tdlvHrCn],
      ]
    case 'mudflat':
      return [
        ['기온', `${spot.minArtmp}-${spot.maxArtmp}°`],
        ['풍속', `${spot.maxWspd}m/s`],
        ['날씨', spot.weather],
        ['체험시간', `${spot.mdftExprnBgngTm}~`],
      ]
    case 'surfing':
      return [
        ['파고', `${spot.avgWvhgt}m`],
        ['파주기', `${spot.avgWvpd}s`],
        ['풍속', `${spot.avgWspd}m/s`],
        ['수온', `${spot.avgWtem}°`],
      ]
  }
}

function detailFields(spot: Spot) {
  switch (spot.experience) {
    case 'travel':
      return [
        ['물때', spot.tdlvHrCn],
        ['날씨', spot.weather],
        ['기온', `${spot.avgArtmp}°C`],
        ['수온', `${spot.avgWtem}°C`],
        ['파고', `${spot.avgWvhgt}m`],
        ['풍속', `${spot.avgWspd}m/s`],
        ['유속', `${spot.avgCrsp}kn`],
        ['시간대', spot.predcNoonSeCd ?? '-'],
      ]
    case 'swimming':
      return [
        ['개장 여부', spot.opnStat],
        ['기온', `${spot.avgArtmp}°C`],
        ['수온', `${spot.avgWtem}°C`],
        ['최고 파고', `${spot.maxWvhgt}m`],
        ['최고 풍속', `${spot.maxWspd}m/s`],
        ['시간대', spot.predcNoonSeCd ?? '-'],
      ]
    case 'fishing':
      return [
        ['대상어', spot.seafsTgfshNm],
        ['물때', spot.tdlvHrCn],
        ['기온', `${spot.minArtmp}~${spot.maxArtmp}°C`],
        ['수온', `${spot.minWtem}~${spot.maxWtem}°C`],
        ['파고', `${spot.minWvhgt}~${spot.maxWvhgt}m`],
        ['풍속', `${spot.minWspd}~${spot.maxWspd}m/s`],
        ['유속', `${spot.minCrsp ?? 0.1}~${spot.maxCrsp ?? 0.3}kn`],
        ['시간대', spot.predcNoonSeCd ?? '-'],
      ]
    case 'scuba':
      return [
        ['물때', spot.tdlvHrCn],
        ['수온', `${spot.minWtem}~${spot.maxWtem}°C`],
        ['파고', `${spot.minWvhgt}~${spot.maxWvhgt}m`],
        ['유속', `${spot.minCrsp}~${spot.maxCrsp}kn`],
        ['시간대', spot.predcNoonSeCd ?? '-'],
      ]
    case 'mudflat':
      return [
        ['체험 시작', spot.mdftExprnBgngTm],
        ['체험 종료', spot.mdftExprnEndTm],
        ['기온', `${spot.minArtmp}~${spot.maxArtmp}°C`],
        ['풍속', `${spot.minWspd}~${spot.maxWspd}m/s`],
        ['날씨', spot.weather],
      ]
    case 'surfing':
      return [
        ['권장 등급', spot.grdCn],
        ['파고', `${spot.avgWvhgt}m`],
        ['파주기', `${spot.avgWvpd}s`],
        ['풍속', `${spot.avgWspd}m/s`],
        ['수온', `${spot.avgWtem}°C`],
        ['시간대', spot.predcNoonSeCd ?? '-'],
      ]
  }
}

function markerColor(label: IndexLabel) {
  const level = INDEX_LEVEL[label]
  if (level >= 4) return '#3b82f6'
  if (level === 3) return '#f59e0b'
  return '#ef4444'
}

function distanceLabel(spot: Spot) {
  if (!geo.loc) return null
  return `${(Math.round(haversine(geo.loc, { lat: spot.lat, lon: spot.lot }) * 10) / 10).toFixed(1)} km`
}

function loadCommunity() {
  const raw = localStorage.getItem('marinepro-community')
  if (raw) {
    community.value = JSON.parse(raw)
    return
  }
  community.value = [
    {
      id: 'seed-1',
      spotId: 'travel-jejube',
      title: '오전 산책 코스가 좋았습니다',
      content: '바람이 약하고 파고가 낮아 해안도로 이동이 편했습니다.',
      imageUrl: null,
      createdAt: new Date().toISOString(),
      author: '익명',
      comments: [],
    },
    {
      id: 'seed-2',
      spotId: 'surf-ingu',
      title: '중급자 연습에 적당한 파도',
      content: '주기가 안정적이라 오전 타임이 특히 괜찮았습니다.',
      imageUrl: null,
      createdAt: new Date().toISOString(),
      author: '익명',
      comments: [],
    },
  ]
  saveCommunity()
}

function saveCommunity() {
  localStorage.setItem('marinepro-community', JSON.stringify(community.value))
}

function submitPost() {
  if (!currentSpot.value || !postForm.title.trim() || !postForm.content.trim()) return
  community.value.unshift({
    id: crypto.randomUUID(),
    spotId: currentSpot.value.id,
    title: postForm.title.trim().slice(0, 120),
    content: postForm.content.trim().slice(0, 2000),
    imageUrl: postForm.imageUrl.trim() || null,
    createdAt: new Date().toISOString(),
    author: user.name,
    authorEmail: user.email,
    comments: [],
  })
  postForm.title = ''
  postForm.content = ''
  postForm.imageUrl = ''
  saveCommunity()
}

function deletePost(id: string) {
  community.value = community.value.filter((post) => post.id !== id)
  saveCommunity()
}

function submitComment(post: CommunityPost) {
  const draft = commentDrafts[post.id]?.trim()
  if (!draft) return
  post.comments.push({
    id: crypto.randomUUID(),
    content: draft.slice(0, 1000),
    createdAt: new Date().toISOString(),
    author: user.name,
  })
  commentDrafts[post.id] = ''
  saveCommunity()
}

function loadUser() {
  const raw = localStorage.getItem('marinepro-user')
  if (!raw) return
  try {
    const saved = JSON.parse(raw)
    user.loggedIn = !!saved.loggedIn
    user.name = saved.name || user.name
    user.email = saved.email || user.email
    user.avatarUrl = saved.avatarUrl || ''
    user.createdAt = saved.createdAt || ''
    settingsForm.displayName = user.name
  } catch {
    localStorage.removeItem('marinepro-user')
  }
}

function saveUser() {
  localStorage.setItem('marinepro-user', JSON.stringify(user))
}

function submitAuth() {
  authMessage.value = ''
  const email = authForm.email.trim()
  const password = authForm.password
  const displayName = authForm.displayName.trim()
  if (!email.includes('@')) {
    authMessage.value = '올바른 이메일을 입력하세요.'
    return
  }
  if (password.length < 6) {
    authMessage.value = '비밀번호는 6자 이상이어야 합니다.'
    return
  }
  if (authMode.value === 'signup' && !displayName) {
    authMessage.value = '닉네임을 입력하세요.'
    return
  }

  user.loggedIn = true
  user.email = email
  user.name = authMode.value === 'signup' ? displayName.slice(0, 40) : displayName || email.split('@')[0]
  user.createdAt = user.createdAt || new Date().toISOString()
  settingsForm.displayName = user.name
  saveUser()
  authForm.password = ''
  navigate('/')
}

function toggleAuthMode() {
  authMode.value = authMode.value === 'signin' ? 'signup' : 'signin'
  authMessage.value = ''
}

function mockOAuth(provider: string) {
  authMessage.value = `${provider} OAuth는 프로토타입 버튼만 제공됩니다.`
}

function signOut() {
  user.loggedIn = false
  saveUser()
  navigate('/')
}

function saveProfile() {
  const name = settingsForm.displayName.trim()
  if (!name) return
  user.name = name.slice(0, 40)
  saveUser()
}

function changePassword() {
  if (settingsForm.newPassword.length < 6) return
  if (settingsForm.newPassword !== settingsForm.confirmPassword) return
  settingsForm.newPassword = ''
  settingsForm.confirmPassword = ''
}

function deleteAccount() {
  if (settingsForm.deleteText.trim() !== '회원탈퇴') return
  community.value = community.value.filter((post) => post.authorEmail !== user.email)
  saveCommunity()
  localStorage.removeItem('marinepro-user')
  user.loggedIn = false
  user.name = 'Marine User'
  user.email = 'demo@marinepro.kr'
  user.avatarUrl = ''
  user.createdAt = ''
  settingsForm.deleteText = ''
  navigate('/')
}

function onAvatarFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return
  const reader = new FileReader()
  reader.onload = () => {
    user.avatarUrl = String(reader.result || '')
    saveUser()
  }
  reader.readAsDataURL(file)
}

function fmt(date: string) {
  const dt = new Date(date)
  return `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

function submitHeaderSearch() {
  allExp.value = 'travel'
  allSort.value = 'index'
  allQuery.value = headerQuery.value.trim()
  allRegion.value = undefined
  updateAllUrl()
  navigate(`/all?exp=travel&sort=index${allQuery.value ? `&q=${encodeURIComponent(allQuery.value)}` : ''}`)
}

function titleForPage() {
  if (page.value === 'all') return `전체 스팟 탐색 - MarinePro.KR`
  if (page.value === 'spot' && currentSpot.value) return `${currentSpot.value.name} - MarinePro.KR`
  if (page.value === 'auth') return '로그인 - MarinePro.KR'
  if (page.value === 'me') return '내 글 - MarinePro.KR'
  if (page.value === 'settings') return '설정 - MarinePro.KR'
  return 'MarinePro.KR - 체험별 해양 레저 지수 대시보드'
}
</script>

<template>
  <div class="app-shell">
    <nav class="site-header">
      <button class="brand" type="button" @click="navigate('/')">MARINEPRO.KR</button>
      <div class="nav-links">
        <button :class="{ active: page === 'home' }" type="button" @click="navigate('/')">대시보드</button>
        <button :class="{ active: page === 'all' }" type="button" @click="goAll()">모두 보기</button>
      </div>
      <form class="header-search" @submit.prevent="submitHeaderSearch">
        <span>Search</span>
        <input v-model="headerQuery" type="search" placeholder="스팟 또는 지역 검색..." />
      </form>
      <button v-if="!user.loggedIn" class="btn primary small" type="button" @click="navigate('/auth')">로그인</button>
      <div v-else class="profile-menu">
        <button class="avatar" type="button" aria-label="프로필 메뉴" @click="profileMenuOpen = !profileMenuOpen">
          <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" />
          <span v-else>{{ user.name.charAt(0).toUpperCase() }}</span>
        </button>
        <div v-if="profileMenuOpen" class="profile-popover">
          <div class="profile-summary">
            <strong>{{ user.name || '사용자' }}</strong>
            <span>{{ user.email }}</span>
          </div>
          <button type="button" @click="navigate('/settings')">설정</button>
          <button type="button" @click="navigate('/me')">내 글 보기</button>
          <button type="button" @click="signOut">로그아웃</button>
        </div>
      </div>
    </nav>

    <main v-if="page === 'home'" class="page dashboard">
      <header class="hero">
        <div>
          <h1>체험별 해양 레저 현황</h1>
          <p>원하는 체험을 선택하면 전국 주요 스팟의 실시간 해양 지수와 기상 데이터를 맞춤형으로 분석해 드립니다.</p>
        </div>
      </header>

      <section class="picker card">
        <div>
          <span class="eyebrow">체험 선택</span>
          <h2>어떤 해양 체험을 찾으시나요?</h2>
          <p>{{ EXPERIENCE_DESC[homeExperience] }}</p>
        </div>
        <label class="date-select">
          <span>날짜 선택</span>
          <select v-model="selectedDate">
            <option v-for="option in dateOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <small>{{ homeSpots.length }}개 스팟 분석 중</small>
        </label>
        <div class="tabs">
          <button v-for="exp in VALID_EXP" :key="exp" :class="{ active: exp === homeExperience }" type="button" @click="homeExperience = exp">
            {{ EXPERIENCE_LABELS[exp] }}
          </button>
        </div>
      </section>

      <section class="section-head">
        <div>
          <h2>스팟 지도</h2>
          <p>마커를 클릭하면 상세 정보로 이동합니다.</p>
        </div>
        <div class="legend"><span class="good"></span>좋음 <span class="warn"></span>보통 <span class="bad"></span>나쁨</div>
      </section>
      <LeafletMap :spots="homeSorted" :height="420" @navigate="(id) => navigate(`/spot/${id}`)" />

      <section class="list-head">
        <div>
          <h2>{{ EXPERIENCE_LABELS[homeExperience] }} 지수 · {{ homeDateLabel }}</h2>
          <p>{{ homeSorted.length }}개 스팟 · 상위 {{ homePreview.length }}개 표시</p>
        </div>
        <div class="list-actions">
          <div class="sort-controls">
            <button v-for="sort in VALID_SORT" :key="sort" :class="{ active: sort === homeSort }" type="button" @click="setHomeSort(sort)">
              {{ SORT_LABELS[sort] }}
            </button>
          </div>
          <button v-if="homeSort === 'distance'" class="btn outline small" type="button" @click="requestLocation">
            {{ geo.loading ? '위치 확인 중...' : geo.loc ? '내 위치 갱신' : '내 위치 사용' }}
          </button>
        </div>
      </section>

      <div class="spot-grid">
        <article v-for="(spot, index) in homePreview" :key="spot.id" class="spot-card" :style="{ animationDelay: `${index * 60}ms` }">
          <div class="spot-card-top">
            <div>
              <p class="meta">{{ spot.region }}<template v-if="spot.predcNoonSeCd"> · {{ spot.predcNoonSeCd }}</template></p>
              <h3>{{ spot.name }}</h3>
              <p class="meta">{{ spot.lat.toFixed(2) }}°N {{ spot.lot.toFixed(2) }}°E</p>
            </div>
            <span class="chip" :class="indexTone(spot.totalIndex).chip">{{ spot.totalIndex }}</span>
          </div>
          <div class="highlight">
            <span>{{ highlight(spot).label }}</span>
            <strong>{{ highlight(spot).value }}</strong>
          </div>
          <div class="stats-grid">
            <div v-for="[label, value] in statsForCard(spot)" :key="label">
              <span>{{ label }}</span>
              <strong>{{ value }}</strong>
            </div>
          </div>
          <button class="link-button" type="button" @click="navigate(`/spot/${spot.id}`)">상세 정보 보기</button>
        </article>
      </div>
      <div class="center-action">
        <button class="btn outline large" type="button" @click="goAll()">모두 보기 ({{ homeSpots.length }})</button>
      </div>
    </main>

    <template v-else-if="page === 'all'">
      <section class="all-hero">
        <div :key="`copy-${allExp}`" class="all-hero-copy">
          <span class="eyebrow">Explore · 전체 스팟</span>
          <h1>{{ EXPERIENCE_LABELS[allExp] }} <span>전국 스팟</span></h1>
          <p>{{ EXPERIENCE_DESC[allExp] }} · <strong>{{ listDateLabel }}</strong> 기준</p>
        </div>
        <div :key="`metrics-${allExp}`" class="metric-grid">
          <div><span>스팟</span><strong>{{ allStats.total }}</strong></div>
          <div><span>좋음↑</span><strong class="primary-text">{{ allStats.great }}</strong></div>
          <div><span>글</span><strong>{{ allStats.totalPosts }}</strong></div>
        </div>
        <div class="tabs wide">
          <button v-for="exp in VALID_EXP" :key="exp" :class="{ active: exp === allExp }" type="button" @click="setAllExp(exp)">
            {{ EXPERIENCE_LABELS[exp] }}
          </button>
        </div>
      </section>

      <main class="page all-page">
        <div :key="`all-content-${allExp}`" class="all-content-motion">
          <button v-if="topSpot && !allQuery && !allRegion" class="top-pick" type="button" @click="navigate(`/spot/${topSpot.id}`)">
            <span>Top Pick</span>
            <small>{{ topSpot.region }}</small>
            <strong>{{ topSpot.name }}</strong>
            <p>{{ summary(topSpot).primary }} · {{ summary(topSpot).secondary }}</p>
            <em>지수 {{ topSpot.totalIndex }}</em>
          </button>

          <div class="all-layout">
            <aside class="region-panel">
              <span class="side-title">지역</span>
              <button :class="{ active: !allRegion }" type="button" @click="setAllRegion(undefined)"><span>전체</span><small>{{ allSpots.length }}</small></button>
              <button v-for="[region, count] in regions" :key="region" :class="{ active: region === allRegion }" type="button" @click="setAllRegion(region === allRegion ? undefined : region)">
                <span>{{ region }}</span><small>{{ count }}</small>
              </button>
            </aside>

            <section>
              <div class="toolbar">
                <input v-model="allQuery" type="search" placeholder="스팟 또는 지역 검색" @input="onAllQueryInput" />
                <select v-model="listDate">
                  <option v-for="option in dateOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <div class="sort-controls">
                  <button v-for="sort in VALID_SORT" :key="sort" :class="{ active: sort === allSort }" type="button" @click="setAllSort(sort)">
                    {{ SORT_LABELS[sort] }}
                  </button>
                </div>
                <button v-if="allSort === 'distance'" class="btn outline small" type="button" @click="requestLocation">
                  {{ geo.loading ? '확인 중' : geo.loc ? '위치 갱신' : '내 위치' }}
                </button>
              </div>
              <div v-if="allRegion || allQuery" class="chips-row">
                <button v-if="allRegion" type="button" @click="setAllRegion(undefined)">{{ allRegion }} x</button>
                <button v-if="allQuery" type="button" @click="allQuery = ''; onAllQueryInput()">"{{ allQuery }}" x</button>
              </div>
              <div class="result-head"><span>{{ sortedAll.length }}개 결과</span><span>{{ SORT_LABELS[allSort] }}</span></div>
              <div v-if="!sortedAll.length" class="empty">일치하는 스팟이 없습니다.</div>
              <ul v-else class="spot-rows">
                <li v-for="(spot, index) in sortedAll" :key="spot.id" :style="{ animationDelay: `${Math.min(index * 24, 180)}ms` }">
                  <button type="button" @click="navigate(`/spot/${spot.id}`)">
                    <span class="row-no">{{ String(index + 1).padStart(2, '0') }}</span>
                    <span class="row-name"><small>{{ spot.region }}</small><strong>{{ spot.name }}</strong></span>
                    <span class="row-summary"><strong>{{ summary(spot).primary }}</strong><small>{{ summary(spot).secondary }}</small></span>
                    <span class="row-community">글 {{ counts[spot.id] ?? 0 }}<template v-if="allSort === 'distance' && geo.loc"> · {{ distanceLabel(spot) }}</template></span>
                    <span class="meter"><small>{{ spot.totalIndex }}</small><i :style="{ width: `${INDEX_LEVEL[spot.totalIndex] * 20}%`, background: markerColor(spot.totalIndex) }"></i></span>
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </template>

    <main v-else-if="page === 'spot' && currentSpot" class="page detail-page">
      <button class="back-link" type="button" @click="navigate('/')">← 대시보드</button>
      <section class="detail-head">
        <div>
          <span class="eyebrow">{{ EXPERIENCE_LABELS[currentSpot.experience] }} · {{ currentSpot.region }}</span>
          <h1>{{ currentSpot.name }}</h1>
          <p>{{ currentSpot.lat.toFixed(4) }}°N · {{ currentSpot.lot.toFixed(4) }}°E · {{ currentSpot.predcYmd }}</p>
        </div>
        <span class="big-chip" :class="indexTone(currentSpot.totalIndex).chip">{{ EXPERIENCE_LABELS[currentSpot.experience] }}지수 · {{ currentSpot.totalIndex }}</span>
      </section>
      <section class="field-grid">
        <div v-for="[label, value] in detailFields(currentSpot)" :key="label">
          <span>{{ label }}</span><strong>{{ value }}</strong>
        </div>
      </section>
      <section class="analysis">
        <h2>분석 요약</h2>
        <p>현재 {{ currentSpot.name }}의 {{ EXPERIENCE_LABELS[currentSpot.experience] }} 지수는 <strong>{{ currentSpot.totalIndex }}</strong> 입니다. 실시간 KHOA 기상·해양 데이터를 기반으로 산출되었으며, 시간대별 변화에 따라 조건이 달라질 수 있습니다.</p>
      </section>
      <section>
        <div class="section-head compact">
          <div>
            <h2>위치</h2>
            <p>{{ currentSpot.lat.toFixed(4) }}°N · {{ currentSpot.lot.toFixed(4) }}°E</p>
          </div>
        </div>
        <LeafletMap class="detail-map" :spots="[currentSpot]" :focus-id="currentSpot.id" :height="360" :navigate-on-click="false" />
      </section>
      <section class="community">
        <div class="section-head compact">
          <div>
            <h2>커뮤니티</h2>
            <p>이 스팟에 대한 후기와 사진을 공유해 보세요.</p>
          </div>
        </div>
        <form v-if="user.loggedIn" class="community-form" @submit.prevent="submitPost">
          <input v-model="postForm.title" maxlength="120" placeholder="제목" />
          <textarea v-model="postForm.content" maxlength="2000" rows="3" placeholder="내용을 입력하세요"></textarea>
          <input v-model="postForm.imageUrl" placeholder="이미지 URL (선택)" />
          <button class="btn primary" type="submit">게시글 작성</button>
        </form>
        <div v-else class="login-callout">
          <p>글을 작성하려면 로그인이 필요합니다.</p>
          <button class="btn primary small" type="button" @click="navigate('/auth')">로그인</button>
        </div>
        <div v-if="!spotPosts.length" class="empty">아직 게시글이 없습니다. 첫 글을 남겨보세요.</div>
        <article v-for="post in spotPosts" :key="post.id" class="post">
          <div class="post-head">
            <div><h3>{{ post.title }}</h3><p>{{ post.author }} · {{ fmt(post.createdAt) }}</p></div>
            <button v-if="user.loggedIn && post.authorEmail === user.email" type="button" @click="deletePost(post.id)">삭제</button>
          </div>
          <p>{{ post.content }}</p>
          <img v-if="post.imageUrl" :src="post.imageUrl" alt="" />
          <button class="link-button" type="button" @click="openPostId = openPostId === post.id ? null : post.id">{{ openPostId === post.id ? '댓글 숨기기' : '댓글 보기 / 작성' }}</button>
          <div v-if="openPostId === post.id" class="comments">
            <p v-if="!post.comments.length" class="muted">아직 댓글이 없습니다.</p>
            <div v-for="comment in post.comments" :key="comment.id" class="comment">
              <strong>{{ comment.author }}</strong><span>{{ fmt(comment.createdAt) }}</span>
              <p>{{ comment.content }}</p>
            </div>
            <form v-if="user.loggedIn" @submit.prevent="submitComment(post)">
              <input v-model="commentDrafts[post.id]" maxlength="1000" placeholder="댓글을 입력하세요" />
              <button class="btn primary small" type="submit">댓글</button>
            </form>
          </div>
        </article>
      </section>
    </main>

    <main v-else-if="page === 'auth'" class="page account-page">
      <section class="account-panel auth-panel">
        <h1>{{ authMode === 'signin' ? '로그인' : '회원가입' }}</h1>
        <p>커뮤니티에 글과 댓글을 남기려면 로그인이 필요합니다.</p>

        <button class="btn oauth" type="button" @click="mockOAuth('Google')">Google로 계속하기</button>

        <div class="divider"><span>또는 이메일</span></div>

        <form class="account-form" @submit.prevent="submitAuth">
          <label v-if="authMode === 'signup'">
            <span>닉네임</span>
            <input v-model="authForm.displayName" maxlength="40" placeholder="커뮤니티에 표시될 이름" />
          </label>
          <label>
            <span>이메일</span>
            <input v-model="authForm.email" type="email" autocomplete="email" />
          </label>
          <label>
            <span>비밀번호</span>
            <input v-model="authForm.password" type="password" autocomplete="current-password" />
          </label>
          <p v-if="authMessage" class="form-message">{{ authMessage }}</p>
          <button class="btn primary full" type="submit">{{ authMode === 'signin' ? '로그인' : '회원가입' }}</button>
        </form>

        <p class="auth-switch">
          {{ authMode === 'signin' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?' }}
          <button type="button" @click="toggleAuthMode">{{ authMode === 'signin' ? '회원가입' : '로그인' }}</button>
        </p>

        <button class="back-link centered" type="button" @click="navigate('/')">← 대시보드로 돌아가기</button>
      </section>
    </main>

    <main v-else-if="page === 'me'" class="page account-page">
      <section v-if="!user.loggedIn" class="account-panel auth-panel">
        <h1>로그인이 필요합니다</h1>
        <p>내가 작성한 커뮤니티 글을 확인하려면 로그인하세요.</p>
        <button class="btn primary" type="button" @click="navigate('/auth')">로그인</button>
      </section>
      <section v-else class="my-page">
        <header class="account-header">
          <span class="eyebrow">내 활동</span>
          <h1>{{ user.name || '내' }}님의 게시글</h1>
          <p>지금까지 작성한 모든 커뮤니티 글을 확인할 수 있습니다.</p>
        </header>

        <div v-if="!myPosts.length" class="empty">아직 작성한 글이 없습니다.</div>
        <div v-else class="my-post-list">
          <button v-for="post in myPosts" :key="post.id" class="my-post-card" type="button" @click="navigate(`/spot/${post.spotId}`)">
            <div>
              <span>{{ getSpot(post.spotId) ? `${EXPERIENCE_LABELS[getSpot(post.spotId)!.experience]} · ${getSpot(post.spotId)!.name}` : post.spotId }}</span>
              <small>{{ new Date(post.createdAt).toLocaleDateString('ko-KR') }}</small>
            </div>
            <h2>{{ post.title }}</h2>
            <p>{{ post.content }}</p>
            <img v-if="post.imageUrl" :src="post.imageUrl" alt="" />
          </button>
        </div>
      </section>
    </main>

    <main v-else-if="page === 'settings'" class="page account-page">
      <section v-if="!user.loggedIn" class="account-panel auth-panel">
        <h1>로그인이 필요합니다</h1>
        <p>프로필 정보와 보안 설정을 관리하려면 로그인하세요.</p>
        <button class="btn primary" type="button" @click="navigate('/auth')">로그인</button>
      </section>
      <section v-else class="settings-page">
        <header class="account-header">
          <span class="eyebrow">계정</span>
          <h1>설정</h1>
          <p>프로필 정보와 보안 설정을 관리합니다.</p>
        </header>

        <section class="settings-card">
          <h2>프로필</h2>
          <div class="profile-editor">
            <div class="avatar-large">
              <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" />
              <span v-else>{{ user.name.charAt(0).toUpperCase() }}</span>
              <label aria-label="프로필 이미지 변경">
                <input type="file" accept="image/*" @change="onAvatarFile" />
                <span>카메라</span>
              </label>
            </div>
            <div>
              <strong>{{ user.name || '사용자' }}</strong>
              <p>{{ user.email }}</p>
              <small>PNG, JPG · 최대 5MB</small>
            </div>
          </div>
          <form class="account-form" @submit.prevent="saveProfile">
            <label>
              <span>닉네임</span>
              <input v-model="settingsForm.displayName" maxlength="40" />
            </label>
            <button class="btn primary" type="submit">프로필 저장</button>
          </form>
        </section>

        <section class="settings-card">
          <h2>비밀번호 변경</h2>
          <form class="account-form" @submit.prevent="changePassword">
            <label>
              <span>새 비밀번호</span>
              <input v-model="settingsForm.newPassword" type="password" autocomplete="new-password" />
            </label>
            <label>
              <span>새 비밀번호 확인</span>
              <input v-model="settingsForm.confirmPassword" type="password" autocomplete="new-password" />
            </label>
            <button class="btn primary" type="submit">비밀번호 변경</button>
          </form>
          <p class="hint">Google 등 소셜 로그인 계정은 비밀번호 변경이 적용되지 않을 수 있습니다.</p>
        </section>

        <section class="settings-card">
          <h2>계정 정보</h2>
          <dl class="account-info">
            <div><dt>이메일</dt><dd>{{ user.email }}</dd></div>
            <div><dt>가입일</dt><dd>{{ user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-' }}</dd></div>
          </dl>
        </section>

        <section class="settings-card danger-card">
          <h2>회원탈퇴</h2>
          <p>탈퇴 시 작성하신 글, 댓글, 프로필 이미지를 포함한 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
          <label class="delete-confirm">
            <span>계속하려면 “회원탈퇴”를 입력하세요.</span>
            <input v-model="settingsForm.deleteText" placeholder="회원탈퇴" />
          </label>
          <button class="btn danger" type="button" :disabled="settingsForm.deleteText.trim() !== '회원탈퇴'" @click="deleteAccount">탈퇴하기</button>
        </section>
      </section>
    </main>

    <main v-else class="page auth-page">
      <section class="card narrow">
        <h1>스팟을 찾을 수 없습니다</h1>
        <button class="link-button" type="button" @click="navigate('/')">대시보드로 돌아가기</button>
      </section>
    </main>

    <footer class="footer">
      <span>© 2026 MarinePro.KR — Specialized Maritime Forecasting</span>
      <span>DATA: KHOA · ROMS</span>
      <span>UPDATE: 09:42 KST</span>
    </footer>
  </div>
</template>
