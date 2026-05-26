import { useCallback, useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  limit as fbLimit,
  type DocumentData,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { todayISO } from "@/lib/dates";

export interface PhotoRecord {
  id: string;
  schoolId: string;
  classId: string;
  date: string;
  storageUrl: string;
  storagePath: string;
  width?: number;
  height?: number;
  taggedStudentIds: string[];
  taggedStudentNames?: string[];
  slotId?: string;
  slotTitle?: string;
  caption?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

const uuid = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const getDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

/**
 * Subscribes to today's photos for the active class. Writes go through
 * `uploadPhotos` which streams files into Firebase Storage and stamps
 * matching Firestore metadata docs.
 */
export function usePPPhotos(classId: string | null | undefined) {
  const { teacherData } = useAuth();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  useEffect(() => {
    if (!classId || !teacherData?.schoolId) {
      setLoading(false);
      return;
    }
    // No Firestore-side orderBy on `uploadedAt`. We had one briefly but it
    // dropped freshly-uploaded docs from the snapshot: addDoc writes
    // `uploadedAt: serverTimestamp()` which is null locally until the
    // server confirms (~200-700 ms), and Firestore's local query engine
    // excludes those docs from any orderBy("uploadedAt") result. Net
    // effect for the founder: just-uploaded photos never appeared in the
    // Photo Studio grid or the tagged child's profile. Now we sort in
    // memory below so the new doc shows up the instant addDoc resolves.
    // (2026-05-26 fix.)
    const q = query(
      collection(db, "pp_photos"),
      where("schoolId", "==", teacherData.schoolId),
      where("classId", "==", classId),
      where("date", "==", today),
      fbLimit(200)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: PhotoRecord[] = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          return {
            id: d.id,
            schoolId: data.schoolId,
            classId: data.classId,
            date: data.date,
            storageUrl: data.storageUrl,
            storagePath: data.storagePath,
            width: data.width,
            height: data.height,
            taggedStudentIds: data.taggedStudentIds || [],
            taggedStudentNames: data.taggedStudentNames,
            slotId: data.slotId,
            slotTitle: data.slotTitle,
            caption: data.caption,
            uploadedBy: data.uploadedBy,
            uploadedByName: data.uploadedByName,
            uploadedAt:
              data.uploadedAt instanceof Timestamp
                ? data.uploadedAt.toDate().toISOString()
                : data.uploadedAt,
          };
        });
        // Client-side sort: newest first. Docs with pending
        // serverTimestamp (uploadedAt missing/empty) sort to the TOP
        // since they just got uploaded — better UX than dropping them.
        const toMs = (iso?: string): number => {
          if (!iso) return Number.POSITIVE_INFINITY; // pending → top
          const t = Date.parse(iso);
          return Number.isFinite(t) ? t : 0;
        };
        rows.sort((a, b) => toMs(b.uploadedAt) - toMs(a.uploadedAt));
        setPhotos(rows);
        setLoading(false);
      },
      (err) => {
        console.error("[usePPPhotos] subscription:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [classId, teacherData?.schoolId, today]);

  const uploadPhotos = useCallback(
    async (args: {
      files: File[];
      taggedStudents: { id: string; name: string }[];
      slotId?: string;
      slotTitle?: string;
      caption?: string;
      onProgress?: (per: UploadProgress[]) => void;
    }) => {
      if (!classId || !teacherData?.schoolId) {
        throw new Error("Missing class/school context");
      }
      const { files, taggedStudents, slotId, slotTitle, caption, onProgress } =
        args;

      const progress: UploadProgress[] = files.map((f) => ({
        fileName: f.name,
        progress: 0,
        status: "pending",
      }));
      onProgress?.(progress);

      const completed: PhotoRecord[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        progress[i].status = "uploading";
        onProgress?.([...progress]);

        try {
          // Skip non-image files defensively
          if (!file.type.startsWith("image/")) {
            progress[i].status = "error";
            progress[i].error = "Not an image";
            onProgress?.([...progress]);
            continue;
          }

          // Path convention: pp_photos/{schoolId}/{classId}/{date}/{uuid}.{ext}
          const ext =
            file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
            "jpg";
          const path = `pp_photos/${teacherData.schoolId}/${classId}/${today}/${uuid()}.${ext}`;
          const sref = storageRef(storage, path);

          // Resumable upload so we can report progress
          const task = uploadBytesResumable(sref, file, {
            contentType: file.type,
            customMetadata: {
              schoolId: teacherData.schoolId,
              classId,
              uploadedBy: teacherData.id || "",
            },
          });
          await new Promise<void>((resolve, reject) => {
            task.on(
              "state_changed",
              (snap) => {
                progress[i].progress = Math.round(
                  (snap.bytesTransferred / snap.totalBytes) * 100
                );
                onProgress?.([...progress]);
              },
              (err) => reject(err),
              () => resolve()
            );
          });

          const storageUrl = await getDownloadURL(sref);
          const dims = await getDimensions(file);

          await addDoc(collection(db, "pp_photos"), {
            schoolId: teacherData.schoolId,
            classId,
            date: today,
            storageUrl,
            storagePath: path,
            width: dims.width,
            height: dims.height,
            taggedStudentIds: taggedStudents.map((s) => s.id),
            taggedStudentNames: taggedStudents.map((s) => s.name),
            slotId,
            slotTitle,
            caption: caption?.trim() || undefined,
            uploadedBy: teacherData.id || "",
            uploadedByName: teacherData.name || teacherData.displayName || "Teacher",
            uploadedAt: serverTimestamp(),
          });

          progress[i].status = "done";
          progress[i].progress = 100;
          onProgress?.([...progress]);
        } catch (err) {
          console.error("[usePPPhotos] upload failed:", file.name, err);
          progress[i].status = "error";
          progress[i].error =
            err instanceof Error ? err.message : "Upload failed";
          onProgress?.([...progress]);
        }
      }

      return progress;
    },
    [classId, teacherData, today]
  );

  const deletePhoto = useCallback(async (photo: PhotoRecord) => {
    try {
      // Try to remove the Storage object first — best-effort.
      const sref = storageRef(storage, photo.storagePath);
      try {
        await deleteObject(sref);
      } catch (storageErr) {
        // Object might already be gone — log and proceed to delete the doc.
        console.warn(
          "[usePPPhotos] Storage delete failed (continuing):",
          storageErr
        );
      }
      await deleteDoc(doc(db, "pp_photos", photo.id));
    } catch (err) {
      console.error("[usePPPhotos] delete failed:", err);
      throw err;
    }
  }, []);

  return { photos, loading, uploadPhotos, deletePhoto };
}
