'use client'

import { 
  DeleteButton, 
  EditButton, 
  ViewButton, 
  TextButton, 
  ActionButtonGroup 
} from '@/components/ui/action-buttons'
import { Trash2, Pencil, Eye, Save, Plus, X } from 'lucide-react'

export default function ActionButtonsDemo() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Square Icon Buttons</h2>
        <div className="flex items-center gap-4">
          <DeleteButton onClick={() => alert('Delete clicked')} />
          <EditButton onClick={() => alert('Edit clicked')} />
          <ViewButton onClick={() => alert('View clicked')} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Delete: var(--destructive) | Edit: var(--accent) | View: var(--primary)
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Action Button Groups</h2>
        <div className="space-y-2">
          <ActionButtonGroup
            onView={() => alert('View')}
            onEdit={() => alert('Edit')}
            onDelete={() => alert('Delete')}
          />
          <ActionButtonGroup
            onView={() => alert('View')}
            onEdit={() => alert('Edit')}
          />
          <ActionButtonGroup
            onDelete={() => alert('Delete')}
          />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Text Buttons - Takes space of text</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <TextButton variant="delete" icon={Trash2} onClick={() => alert('Delete')}>
              Delete Item
            </TextButton>
            <TextButton variant="edit" icon={Pencil} onClick={() => alert('Edit')}>
              Edit Details
            </TextButton>
            <TextButton variant="view" icon={Eye} onClick={() => alert('View')}>
              View More
            </TextButton>
          </div>
          
          <div className="flex items-center gap-3">
            <TextButton variant="view" icon={Save} onClick={() => alert('Save')}>
              Save Changes
            </TextButton>
            <TextButton variant="default" icon={Plus} onClick={() => alert('Add')}>
              Add New
            </TextButton>
            <TextButton variant="default" icon={X} onClick={() => alert('Cancel')}>
              Cancel
            </TextButton>
          </div>

          <div className="flex items-center gap-3">
            <TextButton variant="delete" onClick={() => alert('Delete')}>
              No Icon
            </TextButton>
            <TextButton variant="edit">
              Just Text
            </TextButton>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Disabled States</h2>
        <div className="flex items-center gap-4">
          <DeleteButton disabled />
          <EditButton disabled />
          <ViewButton disabled />
          <TextButton variant="delete" disabled icon={Trash2}>Delete</TextButton>
          <TextButton variant="edit" disabled icon={Pencil}>Edit</TextButton>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Usage in Tables</h2>
        <div className="border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-muted/30">
                <td className="p-3">Item 1</td>
                <td className="p-3">Active</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <ViewButton onClick={() => alert('View Item 1')} />
                    <EditButton onClick={() => alert('Edit Item 1')} />
                    <DeleteButton onClick={() => alert('Delete Item 1')} />
                  </div>
                </td>
              </tr>
              <tr className="border-b hover:bg-muted/30">
                <td className="p-3">Item 2</td>
                <td className="p-3">Pending</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <ViewButton onClick={() => alert('View Item 2')} />
                    <EditButton onClick={() => alert('Edit Item 2')} />
                    <DeleteButton onClick={() => alert('Delete Item 2')} />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

