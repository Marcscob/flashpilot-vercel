/**
 * Textos do cadastro/edição de dados pessoais e dos filtros da Loja,
 * nos sete idiomas da interface.
 */
type Lang = "pt" | "pt-PT" | "es" | "en" | "fr" | "it" | "de";

export type ProfileDict = {
  profile: {
    sectionTitle: string;
    sectionDesc: string;
    name: string;
    namePh: string;
    nameRequired: string;
    phone: string;
    phoneOptional: string;
    phonePh: string;
    country: string;
    email: string;
    emailHint: string;
    emailSent: string;
    password: string;
    currentPassword: string;
    newPassword: string;
    repeatPassword: string;
    passwordMismatch: string;
    passwordMin: string;
    passwordChanged: string;
    save: string;
    saving: string;
    saved: string;
    error: string;
    changeEmail: string;
    changePassword: string;
    dangerTitle: string;
    dangerDesc: string;
    dangerConfirmLabel: string;
    dangerConfirmWord: string;
    dangerButton: string;
    dangerWorking: string;
    dangerDone: string;
    dangerFail: string;
  };
  storeFilter: {
    countryLabel: string;
    countryPh: string;
    subjectLabel: string;
    subjectPh: string;
    allSubjects: string;
    empty: string;
  };
};

const pt: ProfileDict = {
  profile: {
    sectionTitle: "Meus dados",
    sectionDesc: "Atualize seu nome, telefone, e-mail e senha.",
    name: "Nome",
    namePh: "Seu nome completo",
    nameRequired: "Informe seu nome.",
    phone: "Telefone",
    phoneOptional: "opcional",
    phonePh: "Número de telefone",
    country: "País",
    email: "E-mail",
    emailHint: "Ao trocar o e-mail, enviamos um link de confirmação para o novo endereço.",
    emailSent: "Enviamos um link de confirmação para o novo e-mail.",
    password: "Senha",
    currentPassword: "Senha atual",
    newPassword: "Nova senha",
    repeatPassword: "Repetir nova senha",
    passwordMismatch: "As senhas não coincidem.",
    passwordMin: "A senha precisa ter pelo menos 6 caracteres.",
    passwordChanged: "Senha alterada.",
    save: "Salvar",
    saving: "Salvando…",
    saved: "Dados salvos.",
    error: "Não foi possível salvar. Tente novamente.",
    changeEmail: "Alterar e-mail",
    changePassword: "Alterar senha",
    dangerTitle: "Excluir minha conta",
    dangerDesc: "Isto apaga definitivamente sua conta, flashcards e anotações. Os registros de compra são mantidos apenas por obrigação fiscal.",
    dangerConfirmLabel: "Para confirmar, digite EXCLUIR",
    dangerConfirmWord: "EXCLUIR",
    dangerButton: "Excluir minha conta",
    dangerWorking: "Excluindo…",
    dangerDone: "Conta excluída.",
    dangerFail: "Não foi possível excluir a conta.",
  },
  storeFilter: {
    countryLabel: "Escolha o seu país",
    countryPh: "Selecione o país",
    subjectLabel: "Matéria",
    subjectPh: "Selecione a matéria",
    allSubjects: "Todas as matérias",
    empty: "Nenhuma matéria disponível para este país.",
  },
};

const ptPT: ProfileDict = {
  profile: {
    ...pt.profile,
    sectionTitle: "Os meus dados",
    sectionDesc: "Atualize o seu nome, telefone, e-mail e palavra-passe.",
    namePh: "O seu nome completo",
    nameRequired: "Indique o seu nome.",
    phonePh: "Número de telefone",
    emailHint: "Ao mudar o e-mail, enviamos um link de confirmação para o novo endereço.",
    password: "Palavra-passe",
    currentPassword: "Palavra-passe atual",
    newPassword: "Nova palavra-passe",
    repeatPassword: "Repetir nova palavra-passe",
    passwordMismatch: "As palavras-passe não coincidem.",
    passwordMin: "A palavra-passe precisa de pelo menos 6 caracteres.",
    passwordChanged: "Palavra-passe alterada.",
    changePassword: "Alterar palavra-passe",
    dangerTitle: "Eliminar a minha conta",
    dangerDesc: "Isto apaga definitivamente a sua conta, cartões e notas. Os registos de compra são mantidos apenas por obrigação fiscal.",
    dangerConfirmLabel: "Para confirmar, escreva EXCLUIR",
    dangerConfirmWord: "EXCLUIR",
    dangerButton: "Eliminar a minha conta",
    dangerWorking: "A eliminar…",
    dangerDone: "Conta eliminada.",
    dangerFail: "Não foi possível eliminar a conta.",
  },
  storeFilter: {
    ...pt.storeFilter,
    countryLabel: "Escolha o seu país",
  },
};

const en: ProfileDict = {
  profile: {
    sectionTitle: "My details",
    sectionDesc: "Update your name, phone, email and password.",
    name: "Name",
    namePh: "Your full name",
    nameRequired: "Please enter your name.",
    phone: "Phone",
    phoneOptional: "optional",
    phonePh: "Phone number",
    country: "Country",
    email: "Email",
    emailHint: "When you change your email, we send a confirmation link to the new address.",
    emailSent: "We sent a confirmation link to the new email.",
    password: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    repeatPassword: "Repeat new password",
    passwordMismatch: "Passwords do not match.",
    passwordMin: "Password must be at least 6 characters.",
    passwordChanged: "Password changed.",
    save: "Save",
    saving: "Saving…",
    saved: "Details saved.",
    error: "Could not save. Please try again.",
    changeEmail: "Change email",
    changePassword: "Change password",
    dangerTitle: "Delete my account",
    dangerDesc: "This permanently deletes your account, flashcards and notes. Purchase records are kept for tax purposes only.",
    dangerConfirmLabel: "To confirm, type DELETE",
    dangerConfirmWord: "DELETE",
    dangerButton: "Delete my account",
    dangerWorking: "Deleting…",
    dangerDone: "Account deleted.",
    dangerFail: "Could not delete the account.",
  },
  storeFilter: {
    countryLabel: "Choose your country",
    countryPh: "Select country",
    subjectLabel: "Subject",
    subjectPh: "Select subject",
    allSubjects: "All subjects",
    empty: "No subjects available for this country.",
  },
};

const es: ProfileDict = {
  profile: {
    sectionTitle: "Mis datos",
    sectionDesc: "Actualiza tu nombre, teléfono, correo y contraseña.",
    name: "Nombre",
    namePh: "Tu nombre completo",
    nameRequired: "Indica tu nombre.",
    phone: "Teléfono",
    phoneOptional: "opcional",
    phonePh: "Número de teléfono",
    country: "País",
    email: "Correo electrónico",
    emailHint: "Al cambiar el correo, enviamos un enlace de confirmación a la nueva dirección.",
    emailSent: "Enviamos un enlace de confirmación al nuevo correo.",
    password: "Contraseña",
    currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña",
    repeatPassword: "Repetir nueva contraseña",
    passwordMismatch: "Las contraseñas no coinciden.",
    passwordMin: "La contraseña debe tener al menos 6 caracteres.",
    passwordChanged: "Contraseña cambiada.",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Datos guardados.",
    error: "No se pudo guardar. Inténtalo de nuevo.",
    changeEmail: "Cambiar correo",
    changePassword: "Cambiar contraseña",
    dangerTitle: "Eliminar mi cuenta",
    dangerDesc: "Esto elimina definitivamente tu cuenta, tarjetas y notas. Los registros de compra se conservan solo por obligación fiscal.",
    dangerConfirmLabel: "Para confirmar, escribe DELETE",
    dangerConfirmWord: "DELETE",
    dangerButton: "Eliminar mi cuenta",
    dangerWorking: "Eliminando…",
    dangerDone: "Cuenta eliminada.",
    dangerFail: "No se pudo eliminar la cuenta.",
  },
  storeFilter: {
    countryLabel: "Elige tu país",
    countryPh: "Selecciona el país",
    subjectLabel: "Materia",
    subjectPh: "Selecciona la materia",
    allSubjects: "Todas las materias",
    empty: "No hay materias disponibles para este país.",
  },
};

const fr: ProfileDict = {
  profile: {
    sectionTitle: "Mes informations",
    sectionDesc: "Mettez à jour votre nom, téléphone, e-mail et mot de passe.",
    name: "Nom",
    namePh: "Votre nom complet",
    nameRequired: "Veuillez indiquer votre nom.",
    phone: "Téléphone",
    phoneOptional: "facultatif",
    phonePh: "Numéro de téléphone",
    country: "Pays",
    email: "E-mail",
    emailHint: "Lors du changement d'e-mail, nous envoyons un lien de confirmation à la nouvelle adresse.",
    emailSent: "Nous avons envoyé un lien de confirmation au nouvel e-mail.",
    password: "Mot de passe",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    repeatPassword: "Répéter le nouveau mot de passe",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
    passwordMin: "Le mot de passe doit contenir au moins 6 caractères.",
    passwordChanged: "Mot de passe modifié.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Informations enregistrées.",
    error: "Enregistrement impossible. Réessayez.",
    changeEmail: "Changer l'e-mail",
    changePassword: "Changer le mot de passe",
    dangerTitle: "Supprimer mon compte",
    dangerDesc: "Cela supprime définitivement votre compte, vos cartes et vos notes. Les enregistrements d'achat sont conservés uniquement pour des raisons fiscales.",
    dangerConfirmLabel: "Pour confirmer, saisissez DELETE",
    dangerConfirmWord: "DELETE",
    dangerButton: "Supprimer mon compte",
    dangerWorking: "Suppression…",
    dangerDone: "Compte supprimé.",
    dangerFail: "Impossible de supprimer le compte.",
  },
  storeFilter: {
    countryLabel: "Choisissez votre pays",
    countryPh: "Sélectionnez le pays",
    subjectLabel: "Matière",
    subjectPh: "Sélectionnez la matière",
    allSubjects: "Toutes les matières",
    empty: "Aucune matière disponible pour ce pays.",
  },
};

const it: ProfileDict = {
  profile: {
    sectionTitle: "I miei dati",
    sectionDesc: "Aggiorna nome, telefono, e-mail e password.",
    name: "Nome",
    namePh: "Il tuo nome completo",
    nameRequired: "Inserisci il tuo nome.",
    phone: "Telefono",
    phoneOptional: "facoltativo",
    phonePh: "Numero di telefono",
    country: "Paese",
    email: "E-mail",
    emailHint: "Cambiando l'e-mail, inviamo un link di conferma al nuovo indirizzo.",
    emailSent: "Abbiamo inviato un link di conferma alla nuova e-mail.",
    password: "Password",
    currentPassword: "Password attuale",
    newPassword: "Nuova password",
    repeatPassword: "Ripeti la nuova password",
    passwordMismatch: "Le password non coincidono.",
    passwordMin: "La password deve avere almeno 6 caratteri.",
    passwordChanged: "Password modificata.",
    save: "Salva",
    saving: "Salvataggio…",
    saved: "Dati salvati.",
    error: "Impossibile salvare. Riprova.",
    changeEmail: "Cambia e-mail",
    changePassword: "Cambia password",
    dangerTitle: "Elimina il mio account",
    dangerDesc: "Questo elimina definitivamente account, flashcard e note. I dati d'acquisto restano solo per obblighi fiscali.",
    dangerConfirmLabel: "Per confermare, scrivi DELETE",
    dangerConfirmWord: "DELETE",
    dangerButton: "Elimina il mio account",
    dangerWorking: "Eliminazione…",
    dangerDone: "Account eliminato.",
    dangerFail: "Impossibile eliminare l'account.",
  },
  storeFilter: {
    countryLabel: "Scegli il tuo paese",
    countryPh: "Seleziona il paese",
    subjectLabel: "Materia",
    subjectPh: "Seleziona la materia",
    allSubjects: "Tutte le materie",
    empty: "Nessuna materia disponibile per questo paese.",
  },
};

const de: ProfileDict = {
  profile: {
    sectionTitle: "Meine Daten",
    sectionDesc: "Aktualisiere Name, Telefon, E-Mail und Passwort.",
    name: "Name",
    namePh: "Dein vollständiger Name",
    nameRequired: "Bitte gib deinen Namen an.",
    phone: "Telefon",
    phoneOptional: "optional",
    phonePh: "Telefonnummer",
    country: "Land",
    email: "E-Mail",
    emailHint: "Bei einer E-Mail-Änderung senden wir einen Bestätigungslink an die neue Adresse.",
    emailSent: "Wir haben einen Bestätigungslink an die neue E-Mail gesendet.",
    password: "Passwort",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    repeatPassword: "Neues Passwort wiederholen",
    passwordMismatch: "Die Passwörter stimmen nicht überein.",
    passwordMin: "Das Passwort muss mindestens 6 Zeichen haben.",
    passwordChanged: "Passwort geändert.",
    save: "Speichern",
    saving: "Speichern…",
    saved: "Daten gespeichert.",
    error: "Speichern nicht möglich. Bitte erneut versuchen.",
    changeEmail: "E-Mail ändern",
    changePassword: "Passwort ändern",
    dangerTitle: "Mein Konto löschen",
    dangerDesc: "Damit werden Konto, Lernkarten und Notizen endgültig gelöscht. Kaufbelege bleiben nur aus steuerlichen Gründen erhalten.",
    dangerConfirmLabel: "Zum Bestätigen DELETE eingeben",
    dangerConfirmWord: "DELETE",
    dangerButton: "Mein Konto löschen",
    dangerWorking: "Wird gelöscht…",
    dangerDone: "Konto gelöscht.",
    dangerFail: "Konto konnte nicht gelöscht werden.",
  },
  storeFilter: {
    countryLabel: "Wähle dein Land",
    countryPh: "Land auswählen",
    subjectLabel: "Fach",
    subjectPh: "Fach auswählen",
    allSubjects: "Alle Fächer",
    empty: "Für dieses Land sind keine Fächer verfügbar.",
  },
};

export const PROFILE_DICTS: Record<Lang, ProfileDict> = {
  pt,
  "pt-PT": ptPT,
  en,
  es,
  fr,
  it,
  de,
};
