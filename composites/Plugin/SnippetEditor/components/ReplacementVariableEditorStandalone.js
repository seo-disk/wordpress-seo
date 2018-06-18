// External dependencies.
import React from "react";
import { convertToRaw } from "draft-js";
import Editor from "draft-js-plugins-editor";
import createMentionPlugin from "draft-js-mention-plugin";
import createSingleLinePlugin from "draft-js-single-line-plugin";
import flow from "lodash/flow";
import debounce from "lodash/debounce";
import isEmpty from "lodash/isEmpty";
import filter from "lodash/filter";
import includes from "lodash/includes";
import PropTypes from "prop-types";
import { speak as a11ySpeak } from "@wordpress/a11y";
import { __, _n, sprintf } from "@wordpress/i18n";
import styled from "styled-components";

// Internal dependencies.
import {
	replacementVariablesShape,
	recommendedReplacementVariablesShape,
} from "../constants";
import { positionSuggestions } from "../positionSuggestions";
import { Mention } from "./Mention";
import {
	serializeEditor,
	unserializeEditor,
	replaceReplacementVariables,
} from "../serialization";
import {
	hasWhitespaceAt,
	getCaretOffset,
	getAnchorBlock,
	insertText,
	removeSelectedText,
	moveCaret,
} from "../replaceText";

/**
 * Serializes the Draft.js editor state into a string.
 *
 * @param {EditorState} The current editor state.
 *
 * @returns {string} The serialized editor state.
 */
const serializeEditorState = flow( [
	convertToRaw,
	serializeEditor,
] );

/**
 * Needed to avoid styling issues on the settings pages iwth the suggestions dropdown,
 * because the button labels have a z-index of 3.
 */
const ZIndexOverride = styled.div`
	div {
		z-index: 5;
	}
`;

/**
 * Creates the trigger string that is needed to show the replacement variable suggestions.
 *
 * The Draft.js mention plugin trigger is set as %. But the suggestions popover only shows
 * when the characters before and after the % are whitespace.
 *
 * @param {boolean} needsPrependedSpace When true, a space is prepended.
 * @param {boolean} needsAppendedSpace  When true, a space is appended.
 *
 * @returns {string} The trigger string.
 */
const getTrigger = ( needsPrependedSpace, needsAppendedSpace ) => {
	let trigger = "%";

	if ( needsPrependedSpace ) {
		trigger = " " + trigger;
	}
	if ( needsAppendedSpace ) {
		trigger += " ";
	}
	return trigger;
};

/**
 * A replacement variable editor. It allows replacements variables as tokens in
 * its editor. It's a small shell on top of Draft.js.
 */
class ReplacementVariableEditorStandalone extends React.Component {
	/**
	 * Constructs the replacement variable editor for use.
	 *
	 * @param {Object}   props                                 The props to instantiate this
	 *                                                         editor with.
	 * @param {string}   props.content                         The content to instantiate this
	 *                                                         editor with.
	 * @param {Object[]} props.replacementVariables            The replacement variables
	 *                                                         that should be available
	 *                                                         in the editor.
	 * @param {Object[]} props.recommendedReplacementVariables The recommended replacement
	 *                                                         variables that should be
	 *                                                         available in the editor.
	 * @param {string}   props.ariaLabelledBy                  The ID of the field this is
	 *                                                         labelled by.
	 * @param {Function} props.onChange                        Called when the content inside
	 *                                                         is edited.
	 * @param {Function} props.onFocus                         Called when this editor is
	 *                                                         focused.
	 * @param {Function} props.onBlur                          Called when this editor is
	 *                                                         unfocused.
	 *
	 * @returns {void}
	 */
	constructor( props ) {
		super( props );

		const {
			content: rawContent,
			replacementVariables,
			recommendedReplacementVariables,
		} = this.props;
		const editorState = unserializeEditor( rawContent, replacementVariables );
		const currentReplacementVariables = this.determineCurrentReplacementVariables(
			replacementVariables,
			recommendedReplacementVariables
		);

		this.state = {
			editorState,
			searchValue: "",
			replacementVariables: currentReplacementVariables,
		};

		/*
		 * To prevent re-rendering the editor excessively we need to set the serialized
		 * content to the passed content. This is possible because the following is
		 * true:
		 * `rawContent === serialize( unserialize( rawContent ) )`
		 */
		this._serializedContent = rawContent;

		this.initializeBinds();
		this.initializeDraftJsPlugins();
	}

	/**
	 * Initializes the scope binding of functions.
	 *
	 * @returns {void}
	 */
	initializeBinds() {
		this.onChange = this.onChange.bind( this );
		this.onSearchChange = this.onSearchChange.bind( this );
		this.setEditorRef = this.setEditorRef.bind( this );
		this.setMentionSuggestionsRef = this.setMentionSuggestionsRef.bind( this );
		this.debouncedA11ySpeak = debounce( a11ySpeak.bind( this ), 500 );
		this.debouncedUpdateMentionSuggestions = debounce( this.updateMentionSuggestions.bind( this ), 100 );
	}

	/**
	 * Initializes the Draft.js mention and single line plugins.
	 *
	 * @returns {void}
	 */
	initializeDraftJsPlugins() {
		/*
		 * The mentions plugin is used to autocomplete the replacement variable
		 * names.
		 */
		this.mentionsPlugin = createMentionPlugin( {
			mentionTrigger: "%",
			entityMutability: "IMMUTABLE",
			positionSuggestions,
			mentionComponent: Mention,
		} );

		this.singleLinePlugin = createSingleLinePlugin( {
			stripEntities: false,
		} );
	}

	/**
	 * Serializes the current content and calls the onChange handler with this
	 * content.
	 *
	 * @param {EditorState} editorState The current state of the editor.
	 *
	 * @returns {void}
	 */
	serializeContent( editorState ) {
		const serializedContent = serializeEditorState( editorState.getCurrentContent() );

		if ( this._serializedContent !== serializedContent ) {
			this._serializedContent = serializedContent;

			this.props.onChange( this._serializedContent );
		}
	}

	/**
	 * Handlers changes to the underlying Draft.js editor.
	 *
	 * @param {EditorState} editorState The Draft.js state.
	 *
	 * @returns {Promise} A promise for when the state is set.
	 */
	onChange( editorState ) {
		return new Promise( ( resolve ) => {
			editorState = replaceReplacementVariables( editorState, this.props.replacementVariables );

			this.setState( {
				editorState,
			}, () => {
				this.serializeContent( editorState );
				resolve();
			} );
		} );
	}

	/**
	 * Filters replacement variables values based on the search term typed by the user.
	 *
	 * @param {string} searchValue The search value typed after the mentionTrigger by the user.
	 * @param {Object[]} replacementVariables The replacement variables to filter.
	 *
	 * @returns {Object[]} A filtered set of replacement variables to show as suggestions to the user.
	 */
	replacementVariablesFilter( searchValue, replacementVariables ) {
		const value = searchValue.toLowerCase();
		return replacementVariables.filter( function( suggestion ) {
			return ! value || suggestion.name.toLowerCase().indexOf( value ) === 0;
		} );
	}

	/**
	 * Determines the current replacement variables to be used.
	 *
	 * When the search value is empty and there are recommended replacement variables:
	 * Try to use the recommended replacement variables.
	 * Otherwise use the normal replacement variables.
	 *
	 * @param {Object[]} replacementVariables            The current replacement variables.
	 * @param {array}    recommendedReplacementVariables The recommended replacement variables.
	 * @param {string}   searchValue                     The current search value.
	 *
	 * @returns {Object[]} The replacement variables to show as suggestions to the user.
	 */
	determineCurrentReplacementVariables( replacementVariables, recommendedReplacementVariables, searchValue = "" ) {
		const useRecommended = searchValue === "" && ! isEmpty( recommendedReplacementVariables );

		if ( useRecommended ) {
			const recommended = filter(
				replacementVariables,
				replaceVar => includes( recommendedReplacementVariables, replaceVar.name ),
			);

			// Ensure there are replacement variables we recommend before using them.
			if ( recommended.length !== 0 ) {
				return recommended;
			}
		}

		return replacementVariables;
	}

	/**
	 * Handles a search change in the mentions plugin.
	 *
	 * @param {string} value The search value.
	 *
	 * @returns {void}
	 */
	onSearchChange( { value } ) {
		const recommendedReplacementVariables = this.determineCurrentReplacementVariables(
			this.props.replacementVariables,
			this.props.recommendedReplacementVariables,
			value,
		);

		this.setState( {
			searchValue: value,
			replacementVariables: this.replacementVariablesFilter( value, recommendedReplacementVariables ),
		} );

		/*
		 * Because of the particular way this component re-renders, on `componentDidUpdate`
		 * the `replacementVariables` in the state are the initial ones. See `onChange`
		 * which runs after `onSearchChange` and re-renders the component. We need to
		 * make sure to get the correct count of the filtered replacementVariables
		 * after the state is updated and before the component is re-rendered again.
		 */
		setTimeout( () => {
			this.announceSearchResults();
		} );
	}

	/**
	 * Announces the search results to assistive technologies using an ARIA live region.
	 *
	 * @returns {void}
	 */
	announceSearchResults() {
		const { replacementVariables } = this.state;

		if ( replacementVariables.length ) {
			this.debouncedA11ySpeak(
				sprintf(
					_n(
						"%d result found, use up and down arrow keys to navigate",
						"%d results found, use up and down arrow keys to navigate",
						replacementVariables.length
					),
					replacementVariables.length,
					"yoast-components"
				),
				"assertive"
			);
		} else {
			this.debouncedA11ySpeak( __( "No results", "yoast-components" ), "assertive" );
		}
	}

	/**
	 * Update the mention suggestions to trigger the repositioning of the popover.
	 *
	 * @returns {void}
	 */
	updateMentionSuggestions() {
		this.mentionSuggestions.forceUpdate();
	}

	/**
	 * Focuses the editor.
	 *
	 * @returns {void}
	 */
	focus() {
		this.editor.focus();
	}

	/**
	 * Sets the editor reference on this component instance.
	 *
	 * @param {Object} editor The editor React reference.
	 *
	 * @returns {void}
	 */
	setEditorRef( editor ) {
		this.editor = editor;
	}

	/**
	 * Sets the mention reference on this component instance.
	 *
	 * @param {Object} mentionSuggestions The mentionSuggestions React reference.
	 *
	 * @returns {void}
	 */
	setMentionSuggestionsRef( mentionSuggestions ) {
		this.mentionSuggestions = mentionSuggestions;
	}

	/**
	 * Triggers the Draft.js mention plugin suggestions autocomplete.
	 *
	 * It does this by inserting the trigger (%) into the editor, replacing the current selection.
	 * Ensures the autocomplete shows by adding spaces around the trigger if needed.
	 *
	 * @returns {void}
	 */
	triggerReplacementVariableSuggestions() {
		// First remove any selected text.
		let editorState = removeSelectedText( this.state.editorState );

		// Get the current block text.
		const selectionState = editorState.getSelection();
		const contentState = editorState.getCurrentContent();
		const blockText = getAnchorBlock( contentState, selectionState ).getText();
		const caretIndex = getCaretOffset( selectionState );

		// Determine the trigger text that is needed to show the replacement variable suggestions.
		const needsPrependedSpace = ! hasWhitespaceAt( blockText, caretIndex - 1 );
		const needsAppendedSpace = ! hasWhitespaceAt( blockText, caretIndex );
		const trigger = getTrigger( needsPrependedSpace, needsAppendedSpace );

		// Insert the trigger.
		editorState = insertText( editorState, trigger );

		// Move the caret if needed.
		if ( needsAppendedSpace ) {
			// The new caret index plus the trigger length, minus the suffix.
			const newCaretIndex = caretIndex + trigger.length - 1;
			editorState = moveCaret( editorState, newCaretIndex );
		}

		// Save the editor state and then focus the editor.
		this.onChange( editorState ).then( () => this.focus() );
	}

	/**
	 * Sets the state of this editor when the incoming content changes.
	 *
	 * @param {Object} nextProps The props this component receives.
	 *
	 * @returns {void}
	 */
	componentWillReceiveProps( nextProps ) {
		const { content, replacementVariables, recommendedReplacementVariables } = this.props;
		const { searchValue } = this.state;

		if (
			( nextProps.content !== this._serializedContent && nextProps.content !== content ) ||
			nextProps.replacementVariables !== replacementVariables
		) {
			this._serializedContent = nextProps.content;
			const editorState = unserializeEditor( nextProps.content, nextProps.replacementVariables );
			const currentReplacementVariables = this.determineCurrentReplacementVariables(
				nextProps.replacementVariables,
				recommendedReplacementVariables,
				searchValue
			);

			this.setState( {
				editorState,
				replacementVariables: this.replacementVariablesFilter( searchValue, currentReplacementVariables ),
			} );
		}
	}

	/**
	 * Update the mention suggestions to trigger the repositioning of the popover.
	 *
	 * @returns {void}
	 */
	componentDidMount() {
		window.addEventListener( "scroll", this.debouncedUpdateMentionSuggestions );
	}

	/**
	 * Cancels the debounced call to A11ySpeak and removes event listeners.
	 *
	 * @returns {void}
	 */
	componentWillUnmount() {
		this.debouncedA11ySpeak.cancel();
		window.removeEventListener( "scroll", this.debouncedUpdateMentionSuggestions );
	}

	/**
	 * Renders the editor including DraftJS and the mentions plugin.
	 *
	 * @returns {ReactElement} The rendered element.
	 */
	render() {
		const { MentionSuggestions } = this.mentionsPlugin;
		const { onFocus, onBlur, ariaLabelledBy, placeholder } = this.props;
		const { editorState, replacementVariables } = this.state;

		return (
			<React.Fragment>
				<Editor
					editorState={ editorState }
					onChange={ this.onChange }
					onFocus={ onFocus }
					onBlur={ onBlur }
					plugins={ [ this.mentionsPlugin, this.singleLinePlugin ] }
					ref={ this.setEditorRef }
					stripPastedStyles={ true }
					ariaLabelledBy={ ariaLabelledBy }
					placeholder={ placeholder }
				/>
				<ZIndexOverride>
					<MentionSuggestions
						onSearchChange={ this.onSearchChange }
						suggestions={ replacementVariables }
						ref={ this.setMentionSuggestionsRef }
					/>
				</ZIndexOverride>
			</React.Fragment>
		);
	}
}

ReplacementVariableEditorStandalone.propTypes = {
	content: PropTypes.string.isRequired,
	replacementVariables: replacementVariablesShape,
	recommendedReplacementVariables: recommendedReplacementVariablesShape,
	ariaLabelledBy: PropTypes.string.isRequired,
	onChange: PropTypes.func.isRequired,
	onFocus: PropTypes.func,
	onBlur: PropTypes.func,
	placeholder: PropTypes.string,
};

ReplacementVariableEditorStandalone.defaultProps = {
	onFocus: () => {},
	onBlur: () => {},
	className: "",
	placeholder: "",
};

export default ReplacementVariableEditorStandalone;
