import { Injectable } from '@nitrostack/core';
import crypto from 'node:crypto';

export interface AuditEntry {
  seq: number;
  prevHash: string;
  hash: string;
  timestamp: string;
  payload: any;
}

export interface VerificationResult {
  valid: boolean;
  breakAtSeq?: number;
}

/**
 * @STUB — Replace with Person B's AuditService at fusion (Hours 5–6)
 * Provides tamper-evident hash-chained logging of all red-team iterations.
 */
@Injectable()
export class AuditService {
  private chain: AuditEntry[] = [];
  private readonly GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

  private calculateHash(seq: number, prevHash: string, timestamp: string, payload: any): string {
    const data = `${seq}:${prevHash}:${timestamp}:${JSON.stringify(payload)}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Append a finding to the audit chain.
   * Interface contract: AuditService.append(entry)
   */
  append(payload: any): AuditEntry {
    const seq = this.chain.length + 1;
    const prevHash = this.chain.length > 0 ? this.chain[this.chain.length - 1].hash : this.GENESIS_HASH;
    const timestamp = new Date().toISOString();
    const hash = this.calculateHash(seq, prevHash, timestamp, payload);

    const entry: AuditEntry = { seq, prevHash, hash, timestamp, payload };
    this.chain.push(entry);
    return entry;
  }

  /**
   * Verifies structural integrity of the entire audit chain.
   * Interface contract: verifyChain(): { valid: boolean, breakAtSeq?: number }
   */
  verifyChain(): VerificationResult {
    for (let i = 0; i < this.chain.length; i++) {
      const entry = this.chain[i];
      const expectedPrevHash = i === 0 ? this.GENESIS_HASH : this.chain[i - 1].hash;

      if (entry.prevHash !== expectedPrevHash) {
        return { valid: false, breakAtSeq: entry.seq };
      }

      const recalculatedHash = this.calculateHash(entry.seq, entry.prevHash, entry.timestamp, entry.payload);
      if (entry.hash !== recalculatedHash) {
        return { valid: false, breakAtSeq: entry.seq };
      }
    }
    return { valid: true };
  }

  /**
   * Helper for Demo Scene 4: Mutate payload of an existing entry to simulate log tampering.
   */
  tamperEntry(seqIndex: number, newPayload: any): void {
    if (this.chain[seqIndex]) {
      this.chain[seqIndex].payload = newPayload;
    }
  }

  /**
   * Restore tampered entry to its original state (for demo scene 4 recovery).
   */
  restoreEntry(seqIndex: number, originalPayload: any): void {
    if (this.chain[seqIndex]) {
      this.chain[seqIndex].payload = originalPayload;
    }
  }

  getChain(): AuditEntry[] {
    return this.chain;
  }

  clear(): void {
    this.chain = [];
  }
}
