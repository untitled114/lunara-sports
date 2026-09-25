import React from 'react';
import { Inbox, Search, FileX, AlertCircle, Plus } from 'lucide-react';
import clsx from 'clsx';

/**
 * EmptyState Component
 *
 * Displays helpful empty state messages when lists/data are empty.
 *
 * @param {string} type - Type of empty state: inbox, search, data, error, custom
 * @param {string} title - Main heading text
 * @param {string} description - Supporting description text
 * @param {ReactNode} icon - Custom icon component (overrides type icon)
 * @param {ReactNode} action - Action button or component
 * @param {string} className - Additional CSS classes
 *
 * Usage:
 * <EmptyState
 *   type="inbox"
 *   title="No messages yet"
 *   description="When you receive messages, they'll appear here."
 * />
 *
 * <EmptyState
 *   type="search"
 *   title="No results found"
 *   description='Try searching for something else'
 * />
 *
 * <EmptyState
 *   title="No projects"
 *   description="Create your first project to get started"
 *   action={
 *     <button onClick={onCreate} className="px-4 py-2 bg-accent-fill text-white rounded-md">
 *       Create project
 *     </button>
 *   }
 * />
 */
const EmptyState = ({ type = 'data', title, description, icon: CustomIcon, action, className = '' }) => {
  // Default icons for each type
  const defaultIcons = {
    inbox: Inbox,
    search: Search,
    data: FileX,
    error: AlertCircle,
    custom: null,
  };

  const IconComponent = CustomIcon || defaultIcons[type];

  return (
    <div className={clsx('flex flex-col items-center justify-center px-4 py-12 text-center', className)}>
      {/* Icon */}
      {IconComponent && (
        <div className="mb-4">
          <IconComponent className="h-16 w-16 text-text-3" />
        </div>
      )}

      {/* Title */}
      {title && <h3 className="t-section text-text-1 mb-2">{title}</h3>}

      {/* Description */}
      {description && <p className="t-small text-text-2 mb-6 max-w-md">{description}</p>}

      {/* Action */}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

// Preset variants for common use cases
EmptyState.NoData = ({ title = 'No data available', description, action }) => (
  <EmptyState type="data" title={title} description={description} action={action} />
);

EmptyState.NoResults = ({ query }) => (
  <EmptyState
    type="search"
    title="No results found"
    description={query ? `No results for "${query}". Try different keywords.` : 'Try adjusting your search or filter.'}
  />
);

EmptyState.NoMessages = ({ action }) => (
  <EmptyState
    type="inbox"
    title="No messages yet"
    description="When you receive messages, they'll appear here."
    action={action}
  />
);

EmptyState.NoProjects = ({ onCreate }) => (
  <EmptyState
    type="data"
    title="No projects found"
    description="Create your first project to get started."
    action={
      onCreate && (
        <button
          onClick={onCreate}
          className="t-small inline-flex items-center gap-2 rounded-md bg-accent-fill px-6 py-3 font-medium text-white hover:bg-accent-fill-hover transition-colors"
        >
          <Plus className="h-5 w-5" />
          Create project
        </button>
      )
    }
  />
);

EmptyState.Error = ({ title = 'Something went wrong', description = 'Please try again later.', action }) => (
  <EmptyState type="error" title={title} description={description} action={action} />
);

export default EmptyState;
