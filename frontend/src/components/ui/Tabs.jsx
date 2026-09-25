import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';

/**
 * Tabs - Tab navigation component
 *
 * Renders with the one shared tab style used site-wide (same look as the
 * `Segmented` control: bg-surface-1 border-border rounded-md p-1, roving
 * tabindex, arrow-key navigation). `variant` is kept for API compatibility
 * with existing callers but no longer changes the rendered style.
 *
 * @param {Object} props
 * @param {Array} props.tabs - Array: { id, label, icon, badge, disabled, content }
 * @param {string} props.activeTab - Currently active tab ID
 * @param {function} props.onChange - Callback: (tabId) => {}
 * @param {string} props.variant - Accepted for backward compatibility; unused
 * @param {boolean} props.urlSync - Sync with URL hash (default: false)
 * @param {string} props.className - Additional classes
 *
 * @example
 * <Tabs
 *   tabs={[
 *     { id: 'overview', label: 'Overview', icon: Home },
 *     { id: 'projects', label: 'Projects', badge: 5 },
 *     { id: 'settings', label: 'Settings', disabled: true }
 *   ]}
 *   activeTab="overview"
 *   onChange={(tabId) => setActiveTab(tabId)}
 * />
 */
// eslint-disable-next-line no-unused-vars
const Tabs = ({ tabs = [], activeTab, onChange, variant = 'underline', urlSync = false, className = '' }) => {
  const [activeTabState, setActiveTabState] = useState(activeTab || tabs[0]?.id);
  const tabRefs = useRef({});

  // Sync with URL hash
  useEffect(() => {
    if (urlSync) {
      const hash = window.location.hash.slice(1);
      if (hash && tabs.find((tab) => tab.id === hash)) {
        setActiveTabState(hash);
      }
    }
  }, [urlSync, tabs]);

  // Update active tab when prop changes
  useEffect(() => {
    if (activeTab && activeTab !== activeTabState) {
      setActiveTabState(activeTab);
    }
  }, [activeTab]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab && !tab.disabled) {
      setActiveTabState(tabId);
      onChange?.(tabId);

      // Update URL hash if enabled
      if (urlSync) {
        window.location.hash = tabId;
      }
    }
  };

  // Roving tabindex selection, matching Segmented: wraps, skips disabled tabs,
  // moves focus and selection together.
  const selectByIndex = (index) => {
    if (tabs.length === 0) return;
    const wrapped = (index + tabs.length) % tabs.length;
    const tab = tabs[wrapped];
    if (!tab || tab.disabled) return;
    handleTabChange(tab.id);
    tabRefs.current[tab.id]?.focus();
  };

  const handleKeyDown = (e, currentIndex) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        selectByIndex(currentIndex + 1);
        break;

      case 'ArrowLeft':
        e.preventDefault();
        selectByIndex(currentIndex - 1);
        break;

      case 'Home':
        e.preventDefault();
        selectByIndex(0);
        break;

      case 'End':
        e.preventDefault();
        selectByIndex(tabs.length - 1);
        break;

      default:
        break;
    }
  };

  return (
    <div className={className}>
      {/* Tab List */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex gap-1 rounded-md bg-surface-1 border border-border p-1 overflow-x-auto scrollbar-thin"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabState;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={clsx(
                't-small flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors focus-visible:outline-2 outline-accent',
                tab.disabled
                  ? 'text-text-3 cursor-not-allowed'
                  : isActive
                    ? 'bg-surface-2 text-text-1'
                    : 'text-text-2 hover:text-text-1 cursor-pointer'
              )}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={clsx(
                    't-label rounded-sm px-2 py-0.5',
                    isActive ? 'bg-accent/20 text-accent' : 'bg-surface-1 text-text-2'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabState;
        return (
          <div key={tab.id} id={`tabpanel-${tab.id}`} role="tabpanel" aria-labelledby={tab.id} hidden={!isActive} className="mt-4">
            {isActive && tab.content}
          </div>
        );
      })}
    </div>
  );
};

export default Tabs;
