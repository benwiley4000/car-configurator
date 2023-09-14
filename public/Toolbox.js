// Separate mapping object for new category and part names
const categoryMapping = {
  frontBumpers: "Front Bumper",
  rearBumpers: "Rear Bumper",
  spoilers: "Spoiler",
};

const partNameMapping = {
  frontBumpers: "Front Bumper",
  rearBumpers: "Rear Bumper",
  spoilers: "Spoiler",
  // Add more mappings for other categories if needed
};

const Toolbox = () => {
  // Extract data from AppConfig.js
  const { cars } = AppConfig;

  // State variables to keep track of the selected car, category, and part
  const [selectedCarIndex, setSelectedCarIndex] = React.useState(0);
  const [selectedCategory, setSelectedCategory] =
    React.useState("frontBumpers");
  const [selectedPartIndex, setSelectedPartIndex] = React.useState({});

  // Function to call the specific function for a given category and element index
  const callSpecificFunction = (category, elementIndex) => {
    // Check the category and index and call the corresponding function
    if (category === "spoilers") {
      changeSpoiler(elementIndex);
    } else if (category === "frontBumpers") {
      changeFrontBumper(elementIndex);
    } else if (category === "rearBumpers") {
      changeRearBumper(elementIndex);
    }
    // ... Add other conditions for other categories and functions here
  };

  const resetToolbox = () => {
    setSelectedCategory("frontBumpers"); // Set the first category as active
    setSelectedPartIndex({}); // Clear the active part indices
  };

  // Function to switch between cars
  window.switchCar = (index) => {
    setSelectedCarIndex(index);
    resetToolbox();
  };

  // Function to switch between categories
  const switchCategory = (category) => {
    setSelectedCategory(category);
  };

  if (selectedCarIndex >= cars.length) {
    // If the selected car index is out of bounds, show a message
    return <div>No data found for the selected car.</div>;
  }

  // Get the selected car based on the index
  const selectedCar = cars[selectedCarIndex];

  // Filter out categories that are empty for the selected car
  const availableCategories = Object.keys(selectedCar).filter(
    (category) =>
      Array.isArray(selectedCar[category]) && selectedCar[category].length > 0,
  );

  // Get the data for the selected category
  const selectedCategoryData = selectedCar[selectedCategory];

  // Function to set the selected part index within the category
  const switchPart = (index) => {
    setSelectedPartIndex((prevSelectedParts) => ({
      ...prevSelectedParts,
      [selectedCategory]: index,
    }));
  };

  // Get the selected part index within the category
  const currentSelectedPartIndex = selectedPartIndex[selectedCategory] || 0;

  // Function to get the updated category name
  const getUpdatedCategoryName = (category) => {
    return categoryMapping[category] || category;
  };

  // Function to get the updated part name
  const getUpdatedPartName = (category, index) => {
    const partName = partNameMapping[category] || category;
    return `${partName} ${index + 1}`;
  };

  return (
    <>
      <div className="toolbox absolute top-[7vh] left-[5vw] second-section-element text-base font-semibold w-[450px]">
        {/* Switch between categories */}
        <div className="flex">
          {availableCategories.map((category, index) => (
            <button
              key={category}
              onClick={() => {
                switchCategory(category);
              }}
              className={
                selectedCategory === category
                  ? "active-tab rounded-xl bg-[#22242A] text-[#6D6D6D] hover:bg-[#2E2F31] transition cursor-pointer py-[12px] px-[20px] w-full"
                  : "rounded-xl bg-[#22242A] text-[#6D6D6D] hover:bg-[#2E2F31] transition cursor-pointer py-[12px] px-[20px] w-full"
              }
            >
              {getUpdatedCategoryName(category)}
            </button>
          ))}
        </div>

        {/* Display the data for the selected category */}
        {selectedCategoryData.length > 0 ? (
          <div className="toolbox-panel w-full bg-[#272727] rounded-xl text-white w-full p-4 transition font-medium space-y-2">
            {selectedCategoryData.map((item, index) => (
              <div
                key={index}
                className={
                  currentSelectedPartIndex === index
                    ? "active-part part-item first-panel-item w-full rounded-xl p-[16px] flex items-center hover:bg-[#454642] cursor-pointer transition py-[20px]"
                    : "part-item first-panel-item w-full rounded-xl p-[16px] flex items-center hover:bg-[#454642] cursor-pointer transition py-[20px]"
                }
                onClick={() => {
                  switchPart(index);
                  callSpecificFunction(selectedCategory, index);
                }}
              >
                <div>{getUpdatedPartName(selectedCategory, index)}</div>
                <div
                  id="check-circle"
                  className="check-circle flex items-center justify-center bg-[#1E1E1E] rounded-full h-[24px] w-[24px]"
                  key={index + 1}
                >
                  <img
                    src="./img/white-check.png"
                    className={
                      currentSelectedPartIndex === index
                        ? "w-1/2 h-1/2"
                        : "hidden"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
};

ReactDOM.render(<Toolbox />, document.querySelector(".toolbox"));
