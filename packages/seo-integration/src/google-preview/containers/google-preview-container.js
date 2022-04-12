import { useDispatch, useSelect } from "@wordpress/data";
import { useCallback, useMemo, useState } from "@wordpress/element";
import { SEO_STORE_NAME } from "@yoast/seo-store";
import { get } from "lodash";
import { PropTypes } from "prop-types";
import { useReplacementVariables } from "../../hooks/useReplacementVariables";

/**
 * Retrieves the base URL from the permalink.
 * Uses a fallback URL in order to keep working when there is no permalink (development environment).
 *
 * @param {string} permalink    The permalink.
 * @param {string} slug         The slug.
 *
 * @returns {string} The base URL.
 */
const useBaseUrl = ( permalink, slug ) => {
	return useMemo( () => {
		let url;
		let baseUrl = "";
		try {
			url = new URL( permalink );
			baseUrl = url.href;
		} catch ( e ) {
			// Fallback on current href
			baseUrl = window.location.href;
		}

		// Strip slug from the url.
		baseUrl = baseUrl.replace( new RegExp( slug + "$" ), "" );
		// Enforce ending with a slash because of the internal handling in the SnippetEditor component.
		if ( ! baseUrl.endsWith( "/" ) ) {
			baseUrl += "/";
		}

		return baseUrl;
	}, [ permalink ] );
};

/**
 * Handles known data for a Google preview component.
 *
 * @param {JSX.Element} as A Google preview component.
 * @param {Object} restProps Props to pass to the Google preview component, that are unhandled by this container.
 *
 * @returns {JSX.Element} A wrapped Google preview component.
 */
const GooglePreviewContainer = ( { as: Component, ...restProps } ) => {
	const title = useSelect( select => select( SEO_STORE_NAME ).selectSeoTitle() );
	const description = useSelect( select => select( SEO_STORE_NAME ).selectMetaDescription() );
	const slug = useSelect( select => select( SEO_STORE_NAME ).selectSlug() );
	let date = useSelect( select => select( SEO_STORE_NAME ).selectDate() );
	const focusKeyphrase = useSelect( select => select( SEO_STORE_NAME ).selectKeyphrase() );
	const morphologyResults = useSelect( select => select( SEO_STORE_NAME ).selectResearchResults( "morphology" ) );
	const isCornerstone = useSelect( select => select( SEO_STORE_NAME ).selectIsCornerstone() );
	const permalink = useSelect( select => select( SEO_STORE_NAME ).selectPermalink() );
	const [ previewMode, setPreviewMode ] = useState( "mobile" );
	const { updateSlug, updateSeoTitle, updateMetaDescription } = useDispatch( SEO_STORE_NAME );

	const data = useMemo( () => ( { title, description, slug } ), [ title, description, slug ] );
	const focusKeyphraseWordForms = useMemo( () => get( morphologyResults, "keyphraseForms", [] ).flat(), [ morphologyResults ] );

	if ( date !== "" ) {
		// eslint-disable-next-line no-undefined
		date = useMemo( () => new Date( date ).toLocaleDateString( undefined, {
			day: "numeric",
			month: "short",
			year: "numeric",
		} ), [ date ] );
	}

	const baseUrl = useBaseUrl( permalink, slug );

	const {
		replacementVariables,
		recommendedReplacementVariables,
	} = useReplacementVariables();

	const handleChange = useCallback( ( key, value ) => {
		switch ( key ) {
			case "mode":
				setPreviewMode( value );
				break;
			case "slug":
				updateSlug( value );
				break;
			case "title":
				updateSeoTitle( value );
				break;
			case "description":
				updateMetaDescription( value );
				break;
			default:
				console.warn( "Unhandled change event in Google Preview container", key, value );
				break;
		}
	}, [ setPreviewMode ] );

	return <Component
		baseUrl={ baseUrl }
		data={ data }
		date={ date }
		keyword={ focusKeyphrase }
		mode={ previewMode }
		wordsToHighlight={ focusKeyphraseWordForms }
		replacementVariables={ replacementVariables }
		recommendedReplacementVariables={ recommendedReplacementVariables }
		isCornerstone={ isCornerstone }
		onChange={ handleChange }
		{ ...restProps }
	/>;
};

GooglePreviewContainer.propTypes = {
	as: PropTypes.elementType.isRequired,
};

GooglePreviewContainer.defaultProps = {};

export default GooglePreviewContainer;
