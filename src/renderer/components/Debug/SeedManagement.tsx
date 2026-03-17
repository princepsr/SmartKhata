import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import { useConfirm } from '../../hooks/useConfirm';

/**
 * Seed Management Component (Debug Only)
 * 
 * Allows developers to seed the database with sample data.
 */
export function SeedManagement() {
  const { confirm, alert } = useConfirm();
  const [seeds, setSeeds] = useState<string[]>([]);
  const [selectedSeed, setSelectedSeed] = useState<string>('');
  const [clearFirst, setClearFirst] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSeeds();
  }, []);

  const fetchSeeds = async () => {
    try {
      const result = await window.api.invoke<string[]>(IPC_CHANNELS.SYSTEM_SEED_LIST);
      if (result.success && result.data) {
        setSeeds(result.data);
        if (result.data.length > 0) {
          setSelectedSeed(result.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch seeds:', err);
    }
  };

  const handleRunSeed = async () => {
    if (!selectedSeed) {
      return;
    }

    const ok = await confirm({
      title: 'Confirm Seeding',
      message: clearFirst 
        ? `Are you sure? This will CLEAR ALL DATA and seed from ${selectedSeed}.`
        : `Are you sure you want to seed from ${selectedSeed}?`,
      type: 'warning',
      confirmLabel: 'Run Seed'
    });

    if (!ok) {
      return;
    }

    try {
      setIsProcessing(true);
      const result = await window.api.invoke(IPC_CHANNELS.SYSTEM_SEED_RUN, {
        seedFile: selectedSeed,
        clearFirst
      });

      if (result.success) {
        await alert({
          title: 'Seeding Successful',
          message: `Database has been seeded with ${selectedSeed}.`,
          type: 'info'
        });
      } else {
        throw new Error(result.error || 'Seeding failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Seeding error:', err);
      await alert({
        title: 'Seeding Failed',
        message,
        type: 'danger'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetDB = async () => {
    const ok = await confirm({
      title: 'CRITICAL: Reset Database',
      message: 'Are you absolutely sure you want to WIPE ALL DATA? This cannot be undone and will reset the entire business data.',
      type: 'danger',
      confirmLabel: 'Yes, Wipe Everything'
    });

    if (!ok) {
      return;
    }

    try {
      setIsProcessing(true);
      const result = await window.api.invoke<{ success: boolean }>(IPC_CHANNELS.SYSTEM_RESET_DB);

      if (result.success) {
        await alert({
          title: 'Database Reset',
          message: 'All business data has been cleared.',
          type: 'info'
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Reset DB error:', err);
      await alert({
        title: 'Reset Failed',
        message,
        type: 'danger'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="debug-component-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="debug-sub-title">Database Seeding</h3>
        <button 
          className="btn btn-secondary" 
          onClick={fetchSeeds}
          disabled={isProcessing}
        >
          Refresh
        </button>
      </div>
      <p className="debug-description">
        Quickly populate the database with development datasets.
      </p>

      <div className="debug-form" style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label htmlFor="seedSelect">Select Seed File</label>
          <select
            id="seedSelect"
            className="form-input"
            value={selectedSeed}
            onChange={(e) => setSelectedSeed(e.target.value)}
            disabled={isProcessing}
          >
            {seeds.map((seed) => (
              <option key={seed} value={seed}>{seed}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginTop: '0.5rem' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={clearFirst}
              onChange={(e) => setClearFirst(e.target.checked)}
              disabled={isProcessing}
            />
            Clear existing data before seeding
          </label>
        </div>

        <button
          onClick={handleRunSeed}
          disabled={isProcessing || !selectedSeed}
          className="btn btn-primary"
          style={{ marginTop: '1rem', width: '100%' }}
        >
          {isProcessing ? 'Seeding...' : 'Run Seed Script'}
        </button>

        {import.meta.env.DEV && (
          <button
            onClick={handleResetDB}
            disabled={isProcessing}
            className="btn btn-danger"
            style={{ marginTop: '1rem', width: '100%' }}
          >
            {isProcessing ? 'Processing...' : 'Reset Database (Wipe All)'}
          </button>
        )}
      </div>

      <div className="debug-footer-note" style={{ color: '#ef4444' }}>
        Warning: These actions can result in permanent data loss.
      </div>
    </div>
  );
}
