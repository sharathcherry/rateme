import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Plus, Verified, Clock, Wand2 } from 'lucide-react';
import { auth, db, storage } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { uploadPhotoWithPresignedUrl } from '../lib/presignedUpload';
import { uploadFileWithProgress } from '../lib/firebaseUpload';

export default function SetupProfile() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [photo1, setPhoto1] = useState(auth.currentUser?.photoURL || '');
  const [photo2, setPhoto2] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState(auth.currentUser?.displayName || '');
  const [checking, setChecking] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  useEffect(() => {
    const checkExisting = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'publicProfiles', auth.currentUser.uid));
          if (snap.exists()) {
            navigate('/browse');
          } else {
            setChecking(false);
          }
        } catch (e) {
          setChecking(false);
        }
      }
    };
    checkExisting();
  }, [navigate]);

  if (checking) {
    return <div className="min-h-screen bg-[#131315] flex items-center justify-center text-[#F0EEE8]">Loading...</div>;
  }

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    
    try {
      const uid = auth.currentUser.uid;
      const email = auth.currentUser.email || '';
      const displayName = displayNameInput.trim() || 'Anonymous';
      
      const finalPhotos = [photo1, photo2].filter(p => p.trim() !== '');
      if (finalPhotos.length === 0) {
        finalPhotos.push('https://picsum.photos/seed/user/400/500');
      }

      // Save Private Profile
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        role: 'user',
        createdAt: serverTimestamp()
      });

      // Save Public Profile
      await setDoc(doc(db, 'publicProfiles', uid), {
        uid,
        displayName,
        location: 'Global',
        photos: finalPhotos,
        reviewsGivenCount: 0,
        averageRating: 0,
        totalRatings: 0,
        ratingBreakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        createdAt: serverTimestamp()
      });

      navigate('/browse');
    } catch (error) {
      console.error('Error saving profile', error);
      alert('Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, photoNum: 1 | 2) => {
    if (!auth.currentUser) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const idToken = await auth.currentUser.getIdToken();
      let downloadURL: string;
      try {
        downloadURL = await uploadPhotoWithPresignedUrl(
          {
            file,
            uid: auth.currentUser.uid,
            photoNum,
            idToken,
          },
          setUploadProgress,
        );
      } catch (presignedError) {
        // Fallback for browser-side S3 CORS/network issues.
        const storagePath = `profiles/${auth.currentUser.uid}/photo_${photoNum}_${Date.now()}_${file.name}`;
        downloadURL = await uploadFileWithProgress(storage, storagePath, file, setUploadProgress);
      }
      
      if (photoNum === 1) setPhoto1(downloadURL);
      if (photoNum === 2) setPhoto2(downloadURL);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      const code = error?.code ? String(error.code) : 'unknown';
      const message = error?.message ? String(error.message) : 'No error message from upload service.';
      alert(`Failed to upload photo.\n\nCode: ${code}\nMessage: ${message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <main className="w-full min-h-screen bg-[#0F0F11] flex flex-col relative overflow-hidden pb-32 max-w-[760px] mx-auto">
      {/* TopAppBar */}
      <nav className="w-full top-0 sticky bg-[#131315] flex justify-between items-center px-6 py-4 z-10">
        <div onClick={() => signOut(auth)} className="flex items-center gap-2 active:scale-95 duration-200 cursor-pointer">
          <ArrowLeft className="text-[#8A8894]" size={20} />
          <span className="text-[#8A8894] font-medium text-sm">Log out</span>
        </div>
        <div className="font-bold tracking-tight text-[#F0EEE8] uppercase text-xs">COMPLETE PROFILE</div>
        <div className="w-10"></div>
      </nav>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-[#1C1C1E] flex">
        <div className="w-1/2 h-full bg-sunset-gradient shadow-[0_0_8px_rgba(255,107,107,0.5)]"></div>
      </div>

      {/* Header Section */}
      <header className="px-6 pt-8 pb-6">
        <h1 className="text-[26px] font-bold text-[#F0EEE8] leading-tight">Set up your profile</h1>
        <p className="text-sm text-[#8A8894] mt-1 font-medium">Add your details to continue</p>
      </header>

      {/* Inputs Details */}
      <section className="px-6 mb-6">
        <label className="text-[13px] text-[#8A8894] font-medium ml-1 mb-1.5 block">Display Name</label>
        <input 
          type="text" 
          value={displayNameInput}
          onChange={e => setDisplayNameInput(e.target.value)}
          placeholder="What should we call you?"
          className="w-full h-[54px] bg-[#1C1C1E] border border-white/5 rounded-[16px] px-5 text-[#F0EEE8] outline-none focus:border-[#FF4D6D] transition-colors"
        />
      </section>

      {/* Photo Selection Grid */}
      <section className="px-6 flex gap-4">
        {/* Photo 1 */}
        <div className="flex-1 flex flex-col gap-3">
          <label 
            className="aspect-[159/200] relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#1C1C1E] to-[#131315] flex items-center justify-center border border-white/5 focus-within:border-primary-container transition-all cursor-pointer shadow-lg"
          >
            <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 1)} className="hidden" disabled={isUploading} />
            {photo1 ? (
              <>
                <img src={photo1} alt="Photo 1" className="w-full h-full object-cover opacity-80" />
                <div className="absolute bottom-3 right-3 w-6 h-6 bg-sunset-gradient rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(255,107,107,0.5)]">
                  <Check className="text-white" size={16} strokeWidth={3} />
                </div>
              </>
            ) : (
              <Plus className="text-[#8A8894]" size={36} />
            )}
          </label>
          <span className="text-[13px] font-medium text-[#F0EEE8] text-center">{isUploading ? `${uploadProgress ?? 0}%` : 'Photo 1'}</span>
        </div>

        {/* Photo 2 */}
        <div className="flex-1 flex flex-col gap-3">
          <label 
            className="aspect-[159/200] relative w-full rounded-2xl border-2 border-dashed border-[#2D2D30] bg-[#1C1C1E] flex flex-col items-center justify-center gap-2 hover:border-[#FF4D6D] focus-within:border-primary-container transition-all overflow-hidden cursor-pointer"
          >
            <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e, 2)} className="hidden" disabled={isUploading} />
            {photo2 ? (
              <>
                <img src={photo2} alt="Photo 2" className="w-full h-full object-cover opacity-80" />
                <div className="absolute bottom-3 right-3 w-6 h-6 bg-sunset-gradient rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(255,107,107,0.5)]">
                  <Check className="text-white" size={16} strokeWidth={3} />
                </div>
              </>
            ) : (
              <>
                <Plus className="text-[#8A8894] mb-1" size={32} />
                <span className="text-[13px] font-medium text-[#8A8894]">Add photo</span>
              </>
            )}
          </label>
          <span className="text-[13px] font-medium text-[#F0EEE8] text-center">{isUploading ? `${uploadProgress ?? 0}%` : 'Photo 2'}</span>
        </div>
      </section>

      {/* Tips Card */}
      <section className="px-6 mt-10">
        <div className="bg-[#1C1C1E] rounded-[20px] p-6 border border-white/5 shadow-lg">
          <h3 className="text-[16px] font-bold text-[#F0EEE8] mb-5 tracking-tight">Tips for better ratings</h3>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <Verified className="text-[#FF4D6D] mt-0.5" size={18} />
              <span className="text-[13.5px] text-[#8A8894] font-medium leading-relaxed">Clear face, natural lighting</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="text-[#FF4D6D] mt-0.5" size={18} />
              <span className="text-[13.5px] text-[#8A8894] font-medium leading-relaxed">Recent and authentic photo</span>
            </li>
            <li className="flex items-start gap-3">
              <Wand2 className="text-[#FF4D6D] mt-0.5" size={18} />
              <span className="text-[13.5px] text-[#8A8894] font-medium leading-relaxed">No heavy filters or edits</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Bottom Action */}
      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[760px] p-6 bg-gradient-to-t from-[#0F0F11] via-[#0F0F11]/90 to-transparent">
        <button 
          onClick={handleSave}
          disabled={isSaving || isUploading}
          className="w-full h-[58px] bg-coral-gradient rounded-[16px] text-[#FFFFFF] font-bold text-[17px] shadow-[0_4px_24px_rgba(255,77,109,0.3)] flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-70 disabled:scale-100"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </footer>
    </main>
  );
}
