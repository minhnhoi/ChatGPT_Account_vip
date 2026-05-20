import { Pencil } from "lucide-react";
import AccountForm from "./AccountForm";

export default function EditAccountModal({
  account,
  onClose,
  onSubmit,
  visitorName = "",
  limitedStatusOnly = false,
}) {
  if (!account) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content tool-modal">
            <div className="modal-header">
              <div>
                <p className="tool-eyebrow mb-1">
                  {limitedStatusOnly ? "STATUS ONLY" : "EDIT RECORD"}
                </p>
                <h5 className="modal-title d-flex align-items-center gap-2">
                  <Pencil size={19} />{" "}
                  {limitedStatusOnly ? "Sửa trạng thái" : "Sửa tài khoản"}
                </h5>
                <small>
                  {account.accountName} ·{" "}
                  {limitedStatusOnly
                    ? "quyền riêng từng tài khoản"
                    : account.loginEmail}
                </small>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              <AccountForm
                mode="edit"
                initialData={account}
                visitorName={visitorName}
                lockOwnerName
                limitedStatusOnly={limitedStatusOnly}
                onCancel={onClose}
                onSubmit={async (payload) => {
                  await onSubmit(account._id, payload);
                  onClose();
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
