# Firebase 환경 변수 설정 가이드

이 프로젝트는 Firebase 설정을 환경 변수로 관리합니다. GitHub에 배포하기 전에 다음 단계를 따르세요.

## 1. Firebase 프로젝트 설정 값 확인

Firebase 콘솔에서 다음 정보를 확인하세요:
- Firebase 프로젝트 설정 → 앱 설정 → 구성

## 2. 환경 변수 설정

### 로컬 개발 환경 (.env.local)

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 값을 입력하세요:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=1:your_app_id:web:your_web_id
VITE_FIREBASE_MEASUREMENT_ID=G_your_measurement_id
```

### GitHub에 배포 (GitHub Pages, Vercel, Netlify 등)

각 배포 플랫폼의 환경 변수 설정에서 위의 `VITE_*` 변수들을 추가하세요.

#### GitHub Pages 배포 (GitHub Actions 사용)

`.github/workflows/deploy.yml` 파일에서 환경 변수를 설정하거나, GitHub Repository Settings → Secrets에서 설정하세요.

#### Vercel 배포

Vercel 대시보드 → Project Settings → Environment Variables에서 설정하세요.

#### Netlify 배포

Netlify 대시보드 → Site Settings → Build & Deploy → Environment에서 설정하세요.

## 3. Firebase 설정 값 예시

Firebase 콘솔에서 다음과 같은 형식의 설정을 확인할 수 있습니다:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:YOUR_APP_ID:web:YOUR_WEB_ID",
  measurementId: "G-YOUR_MEASUREMENT_ID"
};
```

이 값들을 다음과 같이 환경 변수로 매핑하세요:

| Firebase 설정 | 환경 변수 |
|---|---|
| apiKey | VITE_FIREBASE_API_KEY |
| authDomain | VITE_FIREBASE_AUTH_DOMAIN |
| projectId | VITE_FIREBASE_PROJECT_ID |
| storageBucket | VITE_FIREBASE_STORAGE_BUCKET |
| messagingSenderId | VITE_FIREBASE_MESSAGING_SENDER_ID |
| appId | VITE_FIREBASE_APP_ID |
| measurementId | VITE_FIREBASE_MEASUREMENT_ID |

## 4. 주의사항

- **`.env.local` 파일은 Git에 커밋하지 마세요** - `.gitignore`에 이미 추가되어 있습니다.
- **API 키는 절대 공개하지 마세요** - 배포 플랫폼의 보안 환경 변수 설정을 사용하세요.
- **`VITE_` 접두사는 필수입니다** - Vite에서 프론트엔드에 노출되는 환경 변수입니다.

## 5. 배포 플랫폼별 가이드

### GitHub Pages + GitHub Actions

`.github/workflows/deploy.yml` 파일 예시:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    env:
      VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
      VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
      VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
      VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
      VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
      VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
      VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/public
```

### Vercel

Vercel CLI를 사용하거나 Vercel 대시보드에서 환경 변수를 설정한 후:

```bash
vercel --prod
```

### Netlify

Netlify CLI를 사용하거나 Netlify 대시보드에서 환경 변수를 설정한 후:

```bash
netlify deploy --prod
```

## 6. 로컬 테스트

환경 변수가 올바르게 설정되었는지 확인하려면:

```bash
npm run dev
```

브라우저 콘솔에서 오류가 없는지 확인하세요.

## 7. 빌드 테스트

배포 전에 프로덕션 빌드를 테스트하세요:

```bash
npm run build
npm run preview
```
