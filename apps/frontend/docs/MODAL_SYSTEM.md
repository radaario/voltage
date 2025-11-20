# Modal System Documentation

## Overview

Voltage projesinde yeni bir modal yönetim sistemi oluşturduk. Bu sistem:

- **Z-index yönetimi**: Üst üste açılan modallerin otomatik z-index yönetimi
- **Body overflow kontrolü**: Modal açıkken document.body overflow'u otomatik yönetir
- **Modal stack tracking**: Kaç modal açık olduğunu ve hangi modalın en üstte olduğunu takip eder
- **Compound component pattern**: Okunabilir ve esnek modal yapısı
- **Backdrop ve ESC key desteği**: Sadece en üstteki modal kapatılabilir

## Architecture

### 1. ModalContext

`src/contexts/ModalContext.tsx`

Context, tüm açık modalleri bir stack içinde tutar ve şunları sağlar:

```typescript
interface ModalContextType {
	registerModal: (id: string) => number; // Modal kaydeder, z-index döner
	unregisterModal: (id: string) => void; // Modal kaydını siler
	getModalIndex: (id: string) => number; // Modal'ın z-index'ini döner
	isTopModal: (id: string) => boolean; // Modal en üstte mi?
	hasOpenModals: boolean; // Herhangi bir modal açık mı?
	modalCount: number; // Açık modal sayısı
}
```

**Body Overflow Yönetimi:**

- `modalCount > 0` → `document.body.style.overflow = "hidden"`
- `modalCount === 0` → `document.body.style.overflow = ""`

**Z-index Calculation:**

- Base Z-index: `50`
- Her modal: `BASE_Z_INDEX + (stack_position * 10)`
- Örnek: 1. modal = 50, 2. modal = 60, 3. modal = 70

### 2. useModal Hook

`src/hooks/useModal.ts`

Modal lifecycle ve state yönetimini sağlar:

```typescript
const { modalId, zIndex, isAnimating, isTopModal, handleClose, handleBackdropClick } = useModal({
  isOpen: boolean,
  onClose?: () => void
});
```

**Features:**

- Otomatik register/unregister
- Animation state yönetimi
- ESC key handling (sadece top modal için)
- Backdrop click handling

### 3. Modal Base Component

`src/components/base/Modal/Modal.tsx`

Compound component pattern ile esnek modal yapısı:

```tsx
<Modal
	isOpen={isOpen}
	onClose={onClose}
	size="2xl">
	<Modal.Header onClose={onClose}>
		<h2>Title</h2>
	</Modal.Header>

	<Modal.Content>
		<p>Content here...</p>
	</Modal.Content>

	<Modal.Footer>
		<Button onClick={onClose}>Cancel</Button>
		<Button onClick={handleSave}>Save</Button>
	</Modal.Footer>
</Modal>
```

**Props:**

```typescript
interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	children: ReactNode;
	size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full";
	closeOnBackdrop?: boolean; // Default: true
	closeOnEscape?: boolean; // Default: true
}

interface ModalHeaderProps {
	children: ReactNode;
	onClose?: () => void;
	showCloseButton?: boolean; // Default: true
}

interface ModalContentProps {
	children: ReactNode;
	className?: string;
	noPadding?: boolean; // Default: false
}

interface ModalFooterProps {
	children: ReactNode;
	className?: string;
}
```

## Usage Examples

### Example 1: Simple Confirmation Modal

```tsx
import { Modal, Button } from "@/components";

function MyComponent() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<Button onClick={() => setIsOpen(true)}>Delete Item</Button>

			<Modal
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				size="md">
				<Modal.Header onClose={() => setIsOpen(false)}>
					<h3>Confirm Delete</h3>
				</Modal.Header>

				<Modal.Content>
					<p>Are you sure you want to delete this item?</p>
				</Modal.Content>

				<Modal.Footer>
					<Button
						variant="ghost"
						onClick={() => setIsOpen(false)}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={handleDelete}>
						Delete
					</Button>
				</Modal.Footer>
			</Modal>
		</>
	);
}
```

### Example 2: Form Modal with Custom Styling

```tsx
<Modal
	isOpen={isOpen}
	onClose={onClose}
	size="lg"
	closeOnBackdrop={false} // Prevent accidental close
>
	<Modal.Header onClose={onClose}>
		<div className="flex items-center gap-3">
			<UserIcon className="w-6 h-6" />
			<h2>Edit Profile</h2>
		</div>
	</Modal.Header>

	<Modal.Content>
		<form className="space-y-4">
			<Input
				label="Name"
				value={name}
				onChange={setName}
			/>
			<Input
				label="Email"
				value={email}
				onChange={setEmail}
			/>
		</form>
	</Modal.Content>

	<Modal.Footer className="justify-between">
		<Button
			variant="ghost"
			onClick={onClose}>
			Cancel
		</Button>
		<Button onClick={handleSave}>Save Changes</Button>
	</Modal.Footer>
</Modal>
```

### Example 3: Nested Modals

```tsx
function ParentComponent() {
	const [showParent, setShowParent] = useState(false);
	const [showChild, setShowChild] = useState(false);

	return (
		<>
			{/* Parent Modal */}
			<Modal
				isOpen={showParent}
				onClose={() => setShowParent(false)}>
				<Modal.Header onClose={() => setShowParent(false)}>
					<h2>Parent Modal</h2>
				</Modal.Header>
				<Modal.Content>
					<Button onClick={() => setShowChild(true)}>Open Child Modal</Button>
				</Modal.Content>
			</Modal>

			{/* Child Modal - will appear on top with higher z-index */}
			<Modal
				isOpen={showChild}
				onClose={() => setShowChild(false)}>
				<Modal.Header onClose={() => setShowChild(false)}>
					<h2>Child Modal</h2>
				</Modal.Header>
				<Modal.Content>
					<p>This modal has a higher z-index automatically!</p>
				</Modal.Content>
			</Modal>
		</>
	);
}
```

### Example 4: Modal with No Padding Content

```tsx
<Modal
	isOpen={isOpen}
	onClose={onClose}
	size="5xl">
	<Modal.Header onClose={onClose}>
		<h2>Image Gallery</h2>
	</Modal.Header>

	{/* No padding for full-width image */}
	<Modal.Content noPadding>
		<img
			src={imageUrl}
			className="w-full h-auto"
		/>
	</Modal.Content>

	<Modal.Footer>
		<Button onClick={onClose}>Close</Button>
	</Modal.Footer>
</Modal>
```

## Migration Guide

### Migrating ConfirmModal

✅ **Already migrated** - `ConfirmModal` now uses the new Modal system.

### Migrating Custom Modals

**Before:**

```tsx
const MyModal = ({ isOpen, onClose }) => {
	const [isAnimating, setIsAnimating] = useState(false);

	// Manual overflow management
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
	}, [isOpen]);

	return (
		<div className="fixed inset-0 z-50">
			<div
				className="backdrop"
				onClick={onClose}
			/>
			<div className="modal-panel">{/* content */}</div>
		</div>
	);
};
```

**After:**

```tsx
import { Modal } from "@/components";

const MyModal = ({ isOpen, onClose }) => {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			size="2xl">
			<Modal.Header onClose={onClose}>
				<h2>Title</h2>
			</Modal.Header>
			<Modal.Content>{/* content */}</Modal.Content>
		</Modal>
	);
};
```

## Best Practices

1. **Always use ModalProvider**: Wrap your app with `<ModalProvider>` in `App.tsx`

2. **Let the system handle z-index**: Don't manually set z-index on modals

3. **Use compound components**: Prefer `Modal.Header`, `Modal.Content`, `Modal.Footer` for consistency

4. **Handle loading states**: Use `closeOnBackdrop={false}` during async operations

5. **Clean up on unmount**: The system automatically handles cleanup, but ensure your `onClose` callback properly resets state

## Size Reference

| Size   | Max Width   | Use Case                       |
| ------ | ----------- | ------------------------------ |
| `sm`   | 24rem       | Small confirmations            |
| `md`   | 28rem       | Simple forms                   |
| `lg`   | 32rem       | Standard modals (ConfirmModal) |
| `xl`   | 36rem       | Detailed forms                 |
| `2xl`  | 42rem       | Default - balanced size        |
| `3xl`  | 48rem       | Large content                  |
| `4xl`  | 56rem       | Very large content             |
| `5xl`  | 64rem       | Full-featured modals           |
| `full` | 100% - 1rem | Maximum available space        |

## Troubleshooting

### Modal not appearing

- Check if `ModalProvider` is in `App.tsx`
- Verify `isOpen` prop is `true`
- Check browser console for errors

### Wrong z-index

- Ensure you're not manually setting z-index
- Modal system automatically manages z-index based on order

### Body scroll not locked

- Verify `ModalProvider` is wrapping your app
- Check if modals are being registered (use React DevTools)

### ESC key not working

- Only the top modal responds to ESC
- Check `closeOnEscape` prop (default is `true`)

## Future Improvements

- [ ] Animation variants (slide, fade, zoom)
- [ ] Modal positioning options (center, top, bottom)
- [ ] Transition duration configuration
- [ ] Focus trap implementation
- [ ] Accessibility improvements (ARIA attributes)
- [ ] Modal history/navigation
