# 📈 Toss Auto Trading Workstation v2 (토스 자동매매 워크스테이션)

[![Next.js](https://img.shields.io/badge/Next.js-16.x-black?style=for-the-badge&logo=next.dotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-DB_&_Auth-green?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](./LICENSE)

**토스 증권 Open API 기반의 고성능 자동매매 워크스테이션 대시보드**입니다.  
본 프로젝트는 AI 기반 전략 실행, 정밀 백테스팅 엔진, 그리고 엄격한 위험 관리 시스템을 탑재하여 안전하고 정밀한 개인화 자동매매 환경을 제공합니다.

> ⚠️ **경고 및 면책 조항 (Disclaimer)**  
> 본 프로그램은 개인의 트레이딩을 보조하는 시스템 도구이며, 투자 권유나 자문을 제공하지 않습니다. 모든 투자 결정과 그에 따른 책임은 투자자 본인에게 있으며, 개발진은 프로그램 사용으로 발생한 어떠한 투자 손실에 대해서도 책임을 지지 않습니다.

---

## ✨ 주요 특징 (Key Features)

### 📊 1. 올인원 트레이딩 대시보드 (Multi-Pane Workspace)
*   **자산 및 포트폴리오 모니터링**: 예수금, 총 평가자산, 평가손익 및 수익률을 한눈에 파악할 수 있는 컴팩트 계정 패널.
*   **실시간 주문 및 티켓**: 지정가/시장가 매수·매도 주문, 가용 자금 검증 및 실시간 주문 접수 상태 표시.
*   **보유 잔고 및 거래 내역**: 보유 종목 현황, 매입단가 대비 실시간 손익 평가, 그리고 일괄 시장가 매도(Panic Sell) 기능 지원.
*   **관심 종목(Watchlist)**: 동적 검색 및 추가/삭제 기능으로 타겟 종목의 가격 변동 추이 모니터링.

### 🛡️ 2. 강력한 안전장치 및 리스크 관리 (Risk & Safety Engine)
*   **서킷 브레이커 (Circuit Breaker)**: 급격한 손실 발생 시 추가 주문 자동 차단.
*   **속도 제한 (Rate Limiter)**: API 요청 과부하로 인한 계정 차단을 예방하는 초당 요청 제어.
*   **Fail-Closed 설계**: API 미연결 시 주문 및 주요 트레이딩 관련 위젯 자동 잠금 처리.
*   **안전한 보안 통신**: API Key 및 계좌번호 정보는 브라우저에서 전송되기 전 로컬에서 **AES-256-GCM**으로 암호화되어 데이터베이스에 안전하게 보관됩니다.

### 🤖 3. AI 기반 자동매매 전략 (AI Strategies)
*   **이동평균 크로스오버 (MA Crossover)**: 단기/장기 이동평균선 돌파에 따른 모멘텀 매매.
*   **RSI 평균회귀 (RSI Mean Reversion)**: 상대강도지수(RSI) 과매수/과매도 구간을 활용한 단기 반등 매매.
*   **개별 전략 설정**: 종목별 최소 AI 신뢰도(Confidence Level), 주문 수량 및 매개변수 실시간 활성화/비활성화 제어.

### 🧪 4. 정밀 백테스팅 엔진 (Backtester Engine)
*   과거 가격 데이터(CSV)를 업로드하여 AI 자동매매 전략의 성과를 사전에 시뮬레이션.
*   **성능 지표 요약**: 누적 수익률(Total Return), 연평균 성장률(CAGR), 승률(Win Rate), 손익비(Profit Factor), 최대 낙폭(MDD), 샤프 지수(Sharpe Ratio) 연산.
*   자산 평가액 추이 차트(Equity Curve) 및 시뮬레이션 상세 체결 내역 리스트 제공.

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
*   **Next.js 16 (App Router)** - SSR/CSR 최적화 및 현대적 웹 환경 구축
*   **React 19** - 최신 리액트 아키텍처 및 동적 상태 관리
*   **Tailwind CSS v4** - 컴팩트하고 직관적인 트레이딩 UI 스타일링
*   **Lucide React** - 미니멀한 UI 아이콘 시스템

### Database / Backend
*   **Supabase (PostgreSQL)** - 데이터 관리 및 실시간 동기화
*   **RLS (Row Level Security)** - 완벽하게 격리된 사용자 데이터 보안 정책
*   **PostgreSQL RPC (`execute_trade`)** - 원자적(Atomic) 트랜잭션을 통한 안정적인 거래 정산 및 포트폴리오 동기화

---

## 📂 프로젝트 구조 (Directory Structure)

```text
app/                  # Next.js App Router (페이지 및 레이아웃)
components/           # 대시보드 컴포넌트, 차트, 설정 패널, 공통 UI
lib/                  # 공통 컨텍스트(Workstation State), i18n 번역, Supabase 클라이언트
services/             # 트레이딩, 마켓 데이터, AI, 리스크 및 큐 서비스 추상화 레이어
supabase/migrations/  # Supabase 데이터베이스 마이그레이션 파일 (RLS 정책 및 RPC 함수)
types/                # 거래 및 전략 도메인 관련 TypeScript 타입 정의
```

---

## 🚀 시작하기 (Getting Started)

### 1. 환경 변수 설정
프로젝트 루트 폴더에 `.env.local` 파일을 생성하고 다음과 같이 설정합니다.

```env
NEXT_PUBLIC_TRADING_MODE=SIMULATION # SIMULATION, PAPER, 또는 LIVE
NEXT_PUBLIC_AUTH_ENABLED=false     # 테스트 시 true/false 로 인증 활성화 여부 제어
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anonymous-public-key
```

### 2. 패키지 설치
```bash
npm install
```

### 3. 개발 서버 실행
```bash
npm run dev
```
브라우저를 열고 `http://localhost:3000`에 접속하여 실행 중인 워크스테이션을 확인하세요.

### 4. 프로덕션 빌드 및 린트 검사
```bash
npm run build
npm run lint
```

---

## 🔒 데이터 보안 및 트랜잭션 안전성
*   **원자적 정산**: 모든 실시간 매매 및 모의투자는 Supabase DB 내에서 RLS 정책 하에 소유권이 엄격히 검증됩니다. 특히 자산 차감 및 체결 로그 생성은 단일 트랜잭션(`execute_trade` RPC)을 통해 무결성이 보장됩니다.
*   **인증 키 암호화**: 토스 API 연동에 필요한 비밀 키는 로컬 단말단에서 암호화 후 저장되며, 서버 로그 또는 일반 텍스트 형태로 외부에 절대 노출되지 않습니다.

---

## 🤝 기여하기 (Contributing)
1. 이 레포지토리를 Fork 합니다.
2. 새로운 기능 브랜치를 생성합니다. (`git checkout -b feature/AmazingFeature`)
3. 변경 사항을 Commit 합니다. (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push 합니다. (`git push origin feature/AmazingFeature`)
5. Pull Request를 생성해 주세요!

---

## 📄 라이선스 (License)
본 프로젝트는 **MIT License**를 따릅니다. 자세한 내용은 `LICENSE` 파일을 참고해 주세요.
