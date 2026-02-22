# Licensing UI Design

Design principles and specifications for the licensing and trial interface in SmartKhata.

## UX Principles

- **Calm & Professional**: Avoid "Nag-ware" or aggressive popups.
- **Non-Threatening**: Use "Evaluation" instead of "Trial" and "Verification" instead of "Activation".
- **Frictionless**: Segmented input for keys, one-click copying for System ID.

## Components

### 1. Global License Banner

- **Normal (Paid)**: Hidden (unless expiring within 15 days).
- **Warning (Trial/Expiring soon)**: var(--color-warning)
- **Critical (Grace Period/Locked)**: var(--color-error)
- **Content**: Displays remaining days/bills and a "License Details" or "Verify Now" button.

### 2. License Verification Modal

- **Layout**: Clear header "License Verification".
- **System ID Section**: Monospaced code block with a one-click copy button.
- **Key Entry**: Segmented 3-part input field with auto-focus behavior.
- **Success State**: "Verification Complete. SmartKhata is now fully activated!" message with a 2-second auto-close.

## States & Messaging

| State             | Color        | Message                                                                |
| :---------------- | :----------- | :--------------------------------------------------------------------- |
| **Active Trial**  | Cyan/Teal    | "Evaluation: X days / Y bills remaining."                              |
| **Expiring Soon** | Warning      | "Evaluation ends tomorrow. Upgrade to maintain access."                |
| **Grace Period**  | Error        | "Evaluation ended. Please verify within X days to avoid interruption." |
| **Hard Lock**     | Critical Red | "Evaluation period ended. Please verify your license for full access." |
