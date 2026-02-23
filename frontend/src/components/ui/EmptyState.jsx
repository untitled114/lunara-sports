import React from 'react';
import { Inbox, Search, FileX, AlertCircle, Plus } from 'lucide-react';

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
 *     <button onClick={onCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
 *       Create Project
 *     </button>
 *   }
 * />
 */
const EmptyState = ({
  type = 'data',
  title,
  description,
  icon: CustomIcon,
  action,
  className = '',
}) => {
  // Default icons for each type
  const defaultIcons = {
    inbox: Inbox,
    search: Search,
    data: FileX,
    error: AlertCircle,
    custom: null,
  };

  const IconComponent = CustomIcon || defaultIcons[type];

  // Icon colors by type
  const iconColors = {
    inbox: 'text-gray-400',
    search: 'text-blue-400',
    data: 'text-gray-400',
    error: 'text-red-400',
    custom: 'text-gray-400',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Icon */}
      {IconComponent && (
        <div className="mb-4">
          <IconComponent className={`w-16 h-16 ${iconColors[type]}`} />
        </div>
      )}

      {/* Title */}
      {title && (
        <h3 className="text-xl font-semibold text-gray-200 mb-2">
          {title}
        </h3>
      )}

      {/* Description */}
      {description && (
        <p className="text-gray-400 max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};

// Preset variants for common use cases
EmptyState.NoData = ({ title = "No data available", description, action }) => (
  <EmptyState type="data" title={title} description={description} action={action} />
);

EmptyState.NoResults = ({ query }) => (
  <EmptyState
    type="search"
    title="No results found"
    description={query ? `No results for "${query}". Try different keywords.` : "Try adjusting your search or filter."}
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
    description="Create your first project to get started!"
    action={
      onCreate && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Create Project
        </button>
      )
    }
  />
);

EmptyState.Error = ({ title = "Something went wrong", description = "Please try again later.", action }) => (
  <EmptyState type="error" title={title} description={description} action={action} />
);

export default EmptyState;
