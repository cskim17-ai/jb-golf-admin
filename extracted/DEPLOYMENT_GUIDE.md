# JB Golf Admin 배포 가이드

이 프로젝트는 GitHub Pages, Vercel, Netlify 등의 플랫폼에 배포할 수 있습니다.

## 사전 준비

1. **Firebase 프로젝트 준비**: Firebase 콘솔에서 프로젝트를 생성하고 웹 앱을 등록하세요.
2. **환경 변수 설정**: [FIREBASE_ENV_SETUP.md](./FIREBASE_ENV_SETUP.md)를 참고하여 환경 변수를 설정하세요.
3. **GitHub 저장소**: https://github.com/cskim17-ai/jb-golf-admin에 코드를 푸시하세요.

## 배포 옵션

### 옵션 1: GitHub Pages (무료)

#### 1단계: GitHub Repository Settings 설정

1. GitHub 저장소 → Settings → Secrets and variables → Actions
2. 다음 환경 변수들을 추가하세요:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

#### 2단계: GitHub Pages 활성화

1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: gh-pages / (root)
4. Save

#### 3단계: 배포

```bash
git push origin main
```

GitHub Actions가 자동으로 빌드하고 배포합니다. 배포 완료 후 `https://cskim17-ai.github.io/jb-golf-admin/`에서 접근할 수 있습니다.

**주의**: GitHub Pages에서 서브 경로로 배포되므로, `vite.config.ts`에 `base` 옵션을 추가해야 할 수 있습니다:

```typescript
export default defineConfig({
  base: '/jb-golf-admin/',
  // ... 나머지 설정
});
```

### 옵션 2: Vercel (권장)

#### 1단계: Vercel 계정 생성 및 로그인

https://vercel.com에서 계정을 생성하고 로그인하세요.

#### 2단계: 프로젝트 임포트

1. Vercel 대시보드 → New Project
2. GitHub 저장소 선택: `cskim17-ai/jb-golf-admin`
3. Import

#### 3단계: 환경 변수 설정

1. Project Settings → Environment Variables
2. 다음 변수들을 추가하세요:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

#### 4단계: 배포

```bash
git push origin main
```

Vercel이 자동으로 빌드하고 배포합니다.

### 옵션 3: Netlify

#### 1단계: Netlify 계정 생성 및 로그인

https://netlify.com에서 계정을 생성하고 로그인하세요.

#### 2단계: 프로젝트 연결

1. Netlify 대시보드 → Add new site → Import an existing project
2. GitHub 저장소 선택: `cskim17-ai/jb-golf-admin`

#### 3단계: 빌드 설정

- Build command: `pnpm run build`
- Publish directory: `dist/public`

#### 4단계: 환경 변수 설정

1. Site Settings → Build & Deploy → Environment
2. 다음 변수들을 추가하세요:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

#### 5단계: 배포

```bash
git push origin main
```

Netlify가 자동으로 빌드하고 배포합니다.

## 로컬 테스트

배포 전에 로컬에서 테스트하세요:

```bash
# 개발 서버 실행
pnpm run dev

# 프로덕션 빌드 테스트
pnpm run build
pnpm run preview
```

## 문제 해결

### Firebase 설정 오류

- 환경 변수가 올바르게 설정되었는지 확인하세요.
- 배포 플랫폼의 빌드 로그에서 오류 메시지를 확인하세요.

### 빌드 실패

- Node.js 버전이 18 이상인지 확인하세요.
- `pnpm install`을 실행하여 의존성을 설치하세요.
- `pnpm run build`를 실행하여 로컬에서 빌드 오류를 확인하세요.

### 배포 후 페이지가 로드되지 않음

- 브라우저 콘솔에서 오류 메시지를 확인하세요.
- Firebase 설정이 올바른지 확인하세요.
- 배포 플랫폼의 배포 로그를 확인하세요.

## 커스텀 도메인 설정

### GitHub Pages

1. Settings → Pages → Custom domain
2. 도메인 입력 및 저장

### Vercel

1. Project Settings → Domains
2. 도메인 추가

### Netlify

1. Site Settings → Domain management
2. 도메인 추가

## 추가 리소스

- [Firebase 문서](https://firebase.google.com/docs)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
- [GitHub Pages 문서](https://docs.github.com/en/pages)
- [Vercel 문서](https://vercel.com/docs)
- [Netlify 문서](https://docs.netlify.com/)
