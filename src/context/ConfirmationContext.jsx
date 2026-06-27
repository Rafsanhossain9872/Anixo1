import React, { createContext, useContext, useState, useCallback } from 'react';

const ConfirmationContext = createContext();

export function ConfirmationProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const showConfirmation = useCallback((title, message) => {
    return new Promise((resolve) => {
      setDialog({
        title,
        message,
        onConfirm: () => {
          setDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setDialog(null);
          resolve(false);
        },
      });
    });
  }, []);

  return (
    <ConfirmationContext.Provider value={{ showConfirmation }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/70">
          <div className="bg-[#0d0d0d] border-t border-white/10 sm:border rounded-t-2xl sm:rounded-lg p-6 w-full sm:max-w-sm">
            <h3 className="text-sm font-semibold text-white mb-2">{dialog.title}</h3>
            <p className="text-xs text-white/60 mb-6">{dialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={dialog.onCancel}
                className="px-5 py-2.5 text-xs font-medium text-white/70 hover:text-white transition-colors"
              >
                No
              </button>
              <button
                onClick={dialog.onConfirm}
                className="px-5 py-2.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
}
