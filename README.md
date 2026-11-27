# 다이스 와일드

다이스 와일드는 React와 Vite로 만든 한국어 주사위 RPG입니다. 고블린, 마그마 메피트, 얼음 메피트 중 첫 동료를 고르고, 야생 몬스터를 포획해 세 체육관과 보스에 도전합니다. 게임 메뉴에서 클래식 Tenzies도 플레이할 수 있습니다.

## 실행

VS Code에서 프로젝트 폴더를 연 뒤 Node.js와 npm을 사용해 실행합니다.

```sh
npm ci
npm run dev -- --port 5173 --strictPort
```

개인 PC에서는 Chrome 등 브라우저에서 `http://localhost:5173/`을 엽니다. 첫 실행에는 브라우저에서 `www.dnd5eapi.co`에 접속할 수 있어야 합니다.

```sh
npm run lint
npm run build
npm run preview
```

정적 배포에서는 Vite 프리셋과 `npm run build`, 출력 폴더 `dist`를 사용합니다. 서버나 환경 변수는 필요하지 않습니다.

## 몬스터와 공격

- [D&D 5e SRD API 목록](https://www.dnd5eapi.co/api/2014/monsters)과 각 몬스터의 상세 응답을 브라우저가 직접 가져옵니다. 68종을 선별했으며 `src/srdRoster.js`에는 목록의 ID, 한국어 번역, 타입과 등장 지역을 관리합니다. 새 종을 추가하려면 API에 있는 ID를 목록에 추가하고 `public/art/srd/<ID>.png`에 그림을 넣습니다.
- 등급은 CR 1 이하 일반, 5 이하 희귀, 10 이하 영웅, 20 미만 전설급, 20 이상 보스입니다. 등급이 올라갈수록 배지 제한과 기본 HP 및 공격 범위가 높아집니다. 야생에서는 등급 확률을 먼저 결정하고, 해당 지역의 후보를 날씨 가중치로 뽑습니다. 보스는 체육관 메뉴에서 따로 도전합니다.
- 공격 이름과 원본 피해 주사위는 API의 공격에서 가져옵니다. 도감에 원본 피해 유형과 게임에서 사용하는 범위를 함께 표시합니다. HP, 주사위 상한, PP와 타입 상성은 게임 규칙입니다. 공격력과 방어력 능력치는 쓰지 않습니다. 피해 주사위가 확인되는 공격을 최대 4개 선택하며, 가능한 기술 수에 따라 1·3·5·8레벨에 해금합니다.
- 도감에서 한국어·영어 이름으로 검색하고 등급과 타입으로 필터링할 수 있습니다. 발견, 포획, 시작 동료와 보스 격파를 기록합니다. 이미지가 없을 때는 기본 그림을 표시합니다. 원본 이미지 경로는 응답에서 읽으며, 게임 화면에는 새로 그린 픽셀 아트를 사용합니다.

## 저장과 날씨

현재 모험은 브라우저의 `dice-wild-srd-v2` 키에 저장됩니다. 이전 버전의 `dice-wild-v1` 기록은 원래 키에 보존됩니다. 진행은 브라우저와 주소별로 저장됩니다.

몬스터 API 성공 응답은 브라우저에 캐시합니다. 전체 도감이 준비되면 최대 24시간 동안 저장된 데이터를 쓸 수 있습니다. 화면의 **API 다시 확인**으로 실시간 응답을 다시 요청할 수 있습니다. 연결에 실패하면 확보한 데이터 범위에서 플레이할 수 있으며, 첫 실행에 데이터가 없으면 오류와 **다시 시도** 버튼이 표시됩니다.

기본 지역은 초록숲(서울)입니다. 숲과 동굴에서 출발해 배지로 바다·설산과 화산·고대 유적을 순서대로 엽니다. [Open-Meteo](https://open-meteo.com/en/docs)에서 지역의 현재 기온과 날씨를 조회합니다. 같은 등급에서 날씨에 맞는 타입의 등장 가중치는 2배입니다. 연결 실패 때는 기본 확률을 사용합니다. 날씨 코드는 번역하고 게임 타입으로 분류했습니다. 이 프로젝트는 비상업용 공개 API를 사용합니다. [Open-Meteo 이용 조건](https://open-meteo.com/en/terms) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

클라우드의 제한된 인터넷에서 연결이 차단되면 **환경 편집 → 인터넷 액세스**의 허용 도메인에 `www.dnd5eapi.co`와 `api.open-meteo.com`을 추가한 후 **이 대화에 적용**합니다. 웹 미리보기에는 HTTP Previews의 `5173` 포트가 필요합니다.

## 출처와 라이선스

몬스터 API의 원본 이름, 분류, HP, CR, 공격과 피해 주사위를 사용했습니다. 한국어 이름을 추가하고 HP, 공격 범위, PP, 상성과 등장 규칙을 다이스 와일드에 맞게 구성했습니다. [D&D 5e SRD API 문서](https://docs.dnd5eapi.co/) · [5e SRD API 소스](https://github.com/5e-bits/5e-srd-api)

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

클래식 모드는 Prajit Matalia의 MIT 라이선스 Tenzies 코드를 바탕으로 합니다. [LICENSE](LICENSE)
