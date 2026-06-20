# Badamoyeo Frontend

해양 레저 스팟의 체험별 지수, 위치, 커뮤니티 게시글을 보여주는 Vue 3 기반 프론트엔드입니다. 대시보드에서 체험별 추천 스팟을 확인하고, 모두보기/상세보기에서 스팟 정보와 커뮤니티 기능을 사용할 수 있습니다.

## 기술 스택

- Vue 3
- Vite
- TypeScript
- Axios
- Leaflet
- CSS

## 실행 방법

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

빌드 결과 미리보기:

```bash
npm run preview
```

## 환경 변수

`.env.example`을 참고해 `.env`를 생성합니다.

```bash
VITE_API_BASE_URL=http://localhost:8080
```

`VITE_API_BASE_URL`은 백엔드 API 서버 주소입니다. 예를 들어 백엔드가 `/api` prefix로 서비스된다면 해당 prefix까지 포함해서 설정해야 합니다.

## 주요 기능

- 대시보드
  - 체험별 해양 레저 지수 조회
  - 날짜별 지수 확인
  - 지도 마커 기반 스팟 탐색
  - 추천/상위 스팟 카드 표시

- 모두보기
  - 전체 스팟 목록 조회
  - 체험, 정렬, 지역, 검색어 필터
  - 거리순 정렬을 위한 위치 권한 연동

- 상세보기
  - 스팟 상세 지표 표시
  - 지도에서 위치 확인
  - 즐겨찾기 추가/해제
  - 커뮤니티 게시글/댓글 기능

- 커뮤니티
  - 게시글 작성, 수정, 삭제
  - 이미지 업로드
  - 이미지 슬라이더 및 클릭 확대 모달
  - 댓글 작성, 수정, 삭제
  - 좋아요 기능

- 인증
  - 이메일 로그인/회원가입
  - Google, Naver, Kakao OAuth 진입 버튼
  - accessToken 저장 및 요청 헤더 자동 첨부
  - 401 응답 시 `/auth/refresh`로 accessToken 재발급 후 원 요청 재시도

## API 연동

API 클라이언트는 [src/lib/api.ts](src/lib/api.ts)에 모여 있습니다.

- `apiClient`: Axios 인스턴스
- `authApi`: 회원가입, 로그인, 로그아웃, 토큰 갱신, OAuth URL 생성
- `userApi`: 내 정보, 프로필 수정, 이미지 업로드, 내 게시글/즐겨찾기 조회
- `spotApi`: 대시보드, 마커, 스팟 목록/상세, 즐겨찾기
- `postApi`: 게시글, 이미지, 댓글, 좋아요

백엔드 API 명세는 [postman_collection.json](postman_collection.json)을 참고합니다.

## 인증 및 토큰 처리

로그인/회원가입 성공 시 응답의 `accessToken`을 `localStorage`에 저장합니다. refreshToken은 백엔드가 HttpOnly Cookie로 내려주는 것을 전제로 합니다.

요청 흐름:

1. 일반 API 요청 시 accessToken을 `Authorization: Bearer ...` 헤더에 첨부합니다.
2. 응답이 401이면 `/auth/refresh`를 호출합니다.
3. refresh 성공 시 새 accessToken을 저장하고 실패했던 요청을 한 번 재시도합니다.
4. refresh 실패 시 accessToken을 제거합니다.

동시에 여러 요청이 401을 받아도 refresh 요청은 하나만 실행되도록 공유 Promise로 처리합니다.

## 주요 파일 구조

```text
src/
  App.vue                 # 메인 화면, 라우팅 상태, UI 로직
  main.js                 # Vue 앱 진입점
  style.css               # 전역 스타일
  components/
    LeafletMap.vue        # 지도 컴포넌트
  lib/
    api.ts                # API 클라이언트와 타입/정규화 유틸
    marine-data.ts        # 로컬 fallback 해양 스팟 데이터
    spot-utils.ts         # 검색, 정렬, 거리 계산 유틸
    date-utils.ts         # 날짜 옵션 유틸
public/
  favicon.svg
  icons.svg
postman_collection.json   # 백엔드 API 명세
```

## 개발 참고

- 현재 라우팅은 Vue Router 없이 `history.pushState`와 내부 `page` 상태로 처리합니다.
- API 응답 구조가 `data`, `result`, `body`로 감싸져 있어도 `unwrap`/`extractList` 유틸에서 최대한 흡수합니다.
- API 장애 또는 빈 응답 상황에서도 일부 화면은 `marine-data.ts`의 로컬 fallback 데이터를 사용합니다.
