import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BottomNavBar } from '../components/BottomNavBar';
import { Bell, Star } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore';

interface NotificationData {
  id: string;
  raterId?: string;
  targetId?: string;
  score?: number;
  comment?: string;
  createdAt?: any;
  raterProfile?: any;
}

function formatTimeAgo(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  return `${Math.floor(diffInMonths / 12)}y ago`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'ratings'),
          where('targetId', '==', auth.currentUser.uid),
          limit(50)
        );
        const snapshot = await getDocs(q);
        
        // Use a local cache to avoid fetching the same raterProfile multiple times
        const profileCache: Record<string, any> = {};
        
        // Execute profile fetches concurrently using Promise.all
        const notifData = await Promise.all(snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let raterProfile = null;
          
          if (data.raterId) {
            if (profileCache[data.raterId]) {
              raterProfile = profileCache[data.raterId];
            } else {
              try {
                const profileSnap = await getDoc(doc(db, 'publicProfiles', data.raterId));
                if (profileSnap.exists()) {
                  raterProfile = profileSnap.data();
                  profileCache[data.raterId] = raterProfile;
                }
              } catch (e) {
                console.error("Error fetching rater profile", e);
              }
            }
          }
          
          return {
            id: docSnap.id,
            ...data,
            raterProfile
          } as NotificationData;
        }));
        
        // Sort by createdAt descending in memory
        notifData.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
        });

        setNotifications(notifData);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <main className="pt-20 pb-32 px-6 w-full max-w-[760px] mx-auto min-h-screen bg-[#0F0F11]">
      <header className="fixed top-0 left-0 w-full z-50 bg-[#131315]/80 backdrop-blur-xl flex justify-center items-center px-6 h-16 border-b border-white/5">
        <div className="w-full max-w-[760px] mx-auto flex justify-center items-center">
          <h1 className="text-lg font-black tracking-tighter text-[#F0EEE8] uppercase">Notifications</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#8A8894]">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center mt-8">
          <div className="w-20 h-20 rounded-full bg-[#1A1A1F] flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <Bell className="text-[#353437]" size={36} />
          </div>
          <h2 className="text-[22px] font-bold text-[#F0EEE8] mb-3 tracking-tight">No new notifications</h2>
          <p className="text-[15px] text-[#8A8894] max-w-[250px] leading-relaxed mb-8">You have no new notifications right now. Check back later!</p>
          <Link to="/browse" className="h-[52px] px-8 rounded-[16px] bg-[#1C1C1E] border border-white/10 text-white font-bold text-[16px] flex items-center justify-center active:scale-95 transition-transform hover:border-white/20">
            Go browse profiles
          </Link>
        </div>
      ) : (
        <div className="space-y-4 mt-4">
          <div className="mb-6">
            <h3 className="text-[24px] font-bold text-[#F0EEE8] tracking-tight">Recent Activity</h3>
          </div>
          
          {notifications.map(notif => (
            <div key={notif.id} className="bg-[#1A1A1F] rounded-[16px] p-4 border border-white/5 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#2D1B4E] shrink-0 mt-1">
                <img 
                  src={notif.raterProfile?.photos?.[0] || "https://picsum.photos/seed/user/100/100"} 
                  alt="Rater" 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-[#F0EEE8] text-[14px]">
                    {notif.raterProfile?.displayName || 'Someone'} <span className="font-normal text-[#8A8894]">rated your profile</span>
                  </span>
                </div>
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star 
                      key={i} 
                      className={i <= notif.score ? "text-[#F5C842]" : "text-[#353437]"} 
                      size={14} 
                      fill={i <= notif.score ? "currentColor" : "none"} 
                    />
                  ))}
                </div>
                {notif.comment && (
                  <p className="text-[13px] text-[#D4D4D8] leading-relaxed italic bg-[#131315] p-3 rounded-xl border border-white/5">"{notif.comment}"</p>
                )}
                <span className="text-[11px] text-[#8A8894] mt-2 block">{formatTimeAgo(notif.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <BottomNavBar />
    </main>
  );
}
