import { getDownloadURL, ref, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';

export async function uploadFileWithProgress(
  storage: FirebaseStorage,
  storagePath: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const fileRef = ref(storage, storagePath);
  const task = uploadBytesResumable(fileRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (!onProgress) return;
        if (snapshot.totalBytes <= 0) {
          onProgress(0);
          return;
        }
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress(percent);
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

