/**
 * auditedWrites.ts — ported from teacher-dashboard.
 *
 * Thin wrappers around Firestore writes that inject `_lastModifiedBy` and
 * `_lastModifiedAt` on every write. There is no server-side trigger that
 * back-fills these fields in this codebase, so callers MUST route writes
 * through these wrappers to preserve the audit trail.
 */
import {
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type CollectionReference,
  type DocumentReference,
  type DocumentData,
  type WithFieldValue,
  type SetOptions,
  type UpdateData,
} from "firebase/firestore";
import { auth } from "./firebase";

function actor(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error(
      "[auditedWrites] No authenticated user; refusing to write."
    );
  }
  return uid;
}

export function auditedAdd<T extends DocumentData>(
  ref: CollectionReference<T>,
  data: WithFieldValue<T>
) {
  return addDoc(ref, {
    ...data,
    _lastModifiedBy: actor(),
    _lastModifiedAt: serverTimestamp(),
  } as WithFieldValue<T>);
}

export function auditedSet<T extends DocumentData>(
  ref: DocumentReference<T>,
  data: WithFieldValue<T>,
  options?: SetOptions
) {
  const payload = {
    ...data,
    _lastModifiedBy: actor(),
    _lastModifiedAt: serverTimestamp(),
  } as WithFieldValue<T>;
  return options ? setDoc(ref, payload, options) : setDoc(ref, payload);
}

export function auditedUpdate<T extends DocumentData>(
  ref: DocumentReference<T>,
  data: UpdateData<T>
) {
  return updateDoc(ref, {
    ...data,
    _lastModifiedBy: actor(),
    _lastModifiedAt: serverTimestamp(),
  } as UpdateData<T>);
}

export function auditedDelete<T extends DocumentData>(ref: DocumentReference<T>) {
  const by = actor();
  console.info("[auditedDelete]", { path: ref.path, by });
  return deleteDoc(ref);
}
