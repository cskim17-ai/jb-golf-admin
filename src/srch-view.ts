import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

const urlParams = new URLSearchParams(window.location.search);
const deskId = urlParams.get('desk_id');
const container = document.getElementById('content-container');

if (!container) {
  console.error("Container not found");
} else if (!deskId) {
  container.innerHTML = '<p>desk_id 파라미터가 없습니다. URL을 확인해 주세요.</p>';
} else {
  // src/firebase.ts에서 초기화된 db 객체를 재사용하여 Firestore 연동
  onSnapshot(doc(db, "active_sessions", deskId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.content) {
        container.innerHTML = data.content;
      } else {
        container.innerHTML = '<p>전달된 콘텐츠가 없습니다.</p>';
      }
    } else {
      container.textContent = `${deskId} 화면에 전송된 데이터가 없습니다.`;
    }
  }, (error) => {
    console.error("Firestore error: ", error);
    container.innerHTML = '<p>데이터를 불러오는 중 오류가 발생했습니다.</p>';
  });
}
