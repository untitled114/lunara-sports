import React, { useState, useEffect, useRef } from 'react';

/**
 * Tabs - Tab navigation component
 *
 * @param {Object} props
 * @param {Array} props.tabs - Array: { id, label, icon, badge, disabled, content }
 * @param {string} props.activeTab - Currently active tab ID
 * @param {function} props.onChange - Callback: (tabId) => {}
 * @param {string} props.variant - 'underline' | 'pills'
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
 *   variant="underline"
 * />
 */
const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  variant = 'underline',
  urlSync = false,
  className = ''
}) => {
  const [activeTabState, setActiveTabState] = useState(activeTab || tabs[0]?.id);
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabRefs = useRef({});

  // Sync with URL hash
  useEffect(() => {
    if (urlSync) {
      const hash = window.location.hash.slice(1);
      if (hash && tabs.find(tab => tab.id === hash)) {
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

  // Calculate indicator position for underline variant
  useEffect(() => {
    if (variant === 'underline' && tabRefs.current[activeTabState]) {
      const tabElement = tabRefs.current[activeTabState];
      setIndicatorStyle({
        width: tabElement.offsetWidth,
        left: tabElement.offsetLeft
      });
    }
  }, [activeTabState, variant]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.disabled) {
      setActiveTabState(tabId);
      onChange?.(tabId);

      // Update URL hash if enabled
      if (urlSync) {
        window.location.hash = tabId;
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e, currentIndex) => {
    let nextIndex;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) nextIndex = tabs.length - 1;
        while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
          nextIndex--;
          if (nextIndex < 0) nextIndex = tabs.length - 1;
        }
        if (!tabs[nextIndex]?.disabled) {
          handleTabChange(tabs[nextIndex].id);
          tabRefs.current[tabs[nextIndex].id]?.focus();
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        nextIndex = currentIndex + 1;
        if (nextIndex >= tabs.length) nextIndex = 0;
        while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
          nextIndex++;
          if (nextIndex >= tabs.length) nextIndex = 0;
        }
        if (!tabs[nextIndex]?.disabled) {
          handleTabChange(tabs[nextIndex].id);
          tabRefs.current[tabs[nextIndex].id]?.focus();
        }
        break;

      case 'Home':
        e.preventDefault();
        const firstEnabledTab = tabs.find(t => !t.disabled);
        if (firstEnabledTab) {
          handleTabChange(firstEnabledTab.id);
          tabRefs.current[firstEnabledTab.id]?.focus();
        }
        break;

      case 'End':
        e.preventDefault();
        const lastEnabledTab = [...tabs].reverse().find(t => !t.disabled);
        if (lastEnabledTab) {
          handleTabChange(lastEnabledTab.id);
          tabRefs.current[lastEnabledTab.id]?.focus();
        }
        break;

      default:
        break;
    }
  };

  // Variant-specific styles
  const tabListClasses = variant === 'pills'
    ? 'inline-flex p-1 bg-gray-800 rounded-lg border border-gray-700'
    : 'relative flex border-b border-gray-700';

  const getTabClasses = (tab, isActive) => {
    const baseClasses = 'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500';

    if (variant === 'pills') {
      return `${baseClasses} rounded-lg ${
        tab.disabled
          ? 'text-gray-600 cursor-not-allowed'
          : isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-300 hover:bg-gray-700 hover:text-white cursor-pointer'
      }`;
    }

    // Underline variant
    return `${baseClasses} ${
      tab.disabled
        ? 'text-gray-600 cursor-not-allowed'
        : isActive
          ? 'text-indigo-400'
          : 'text-gray-400 hover:text-gray-200 cursor-pointer'
    }`;
  };

  return (
    <div className={className}>
      {/* Tab List */}
      <div
        className={`${tabListClasses} overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900`}
        role="tablist"
        aria-orientation="horizontal"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabState;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[tab.id] = el)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              className={getTabClasses(tab, isActive)}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span className="whitespace-nowrap">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={`
                    ml-1 px-2 py-0.5 text-sm font-semibold rounded-full
                    ${isActive
                      ? 'bg-indigo-800 text-indigo-200'
                      : 'bg-gray-700 text-gray-300'
                    }
                  `}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Animated underline indicator */}
        {variant === 'underline' && (
          <span
            className="absolute bottom-0 h-0.5 bg-[var(--accent)] transition-all duration-300 ease-in-out"
            style={indicatorStyle}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Tab Content */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabState;
        return (
          <div
            key={tab.id}
            id={`tabpanel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={tab.id}
            hidden={!isActive}
            className="mt-4"
          >
            {isActive && tab.content}
          </div>
        );
      })}
    </div>
  );
};

export default Tabs;
